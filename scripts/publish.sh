#!/bin/bash

# Homebridge Philips Air Purifier Plugin - Automated Publishing Script
# This script handles version bumping and publishing to npm

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CHANGELOG="$PROJECT_ROOT/CHANGELOG.md"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
check_project_structure() {
    log_info "Checking project structure..."

    if [[ ! -f "$PACKAGE_JSON" ]]; then
        log_error "package.json not found in $PROJECT_ROOT"
        exit 1
    fi

    if [[ ! -f "$CHANGELOG" ]]; then
        log_warning "CHANGELOG.md not found - this is recommended for releases"
    fi

    log_success "Project structure verified"
}

# Check if git is available and we're in a git repo
check_git_status() {
    log_info "Checking git status..."

    if ! command -v git &> /dev/null; then
        log_error "git is not installed or not in PATH"
        exit 1
    fi

    if [[ ! -d ".git" ]]; then
        log_error "Not in a git repository"
        exit 1
    fi

    # Check if there are uncommitted changes
    if [[ -n "$(git status --porcelain)" ]]; then
        log_warning "There are uncommitted changes:"
        git status --short
        echo
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Publishing cancelled"
            exit 0
        fi
    fi

    # Check if we're on main/master branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
        log_warning "You're not on main/master branch (currently on $CURRENT_BRANCH)"
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Publishing cancelled"
            exit 0
        fi
    fi

    log_success "Git status verified"
}

# Check npm authentication
check_npm_auth() {
    log_info "Checking npm authentication..."

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed or not in PATH"
        exit 1
    fi

    # Check if user is logged in
    if ! npm whoami &> /dev/null; then
        log_error "Not logged in to npm. Please run 'npm login' first"
        exit 1
    fi

    # Get current user
    NPM_USER=$(npm whoami)
    log_info "Logged in as: $NPM_USER"

    # Check package ownership
    PACKAGE_NAME=$(node -p "require('$PACKAGE_JSON').name")
    if npm owner ls "$PACKAGE_NAME" 2>/dev/null | grep -q "$NPM_USER"; then
        log_success "You have publish access to $PACKAGE_NAME"
    else
        log_warning "You may not have publish access to $PACKAGE_NAME"
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Publishing cancelled"
            exit 0
        fi
    fi
}

# Get current version
get_current_version() {
    node -p "require('$PACKAGE_JSON').version"
}

# Get package name
get_package_name() {
    node -p "require('$PACKAGE_JSON').name"
}

# Run pre-publishing checks
run_prepublish_checks() {
    log_info "Running pre-publishing checks..."

    # Change to project directory
    cd "$PROJECT_ROOT"

    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dependencies..."
        npm ci
    fi

    # Run linting
    log_info "Running ESLint..."
    if ! npm run lint; then
        log_error "ESLint failed. Please fix the issues before publishing"
        exit 1
    fi

    # Build the project
    log_info "Building project..."
    if ! npm run build; then
        log_error "Build failed. Please fix the issues before publishing"
        exit 1
    fi

    # Verify build output
    if [[ ! -d "dist" ]] || [[ -z "$(ls -A dist)" ]]; then
        log_error "Build output directory is empty or missing"
        exit 1
    fi

    log_success "Pre-publishing checks passed"
}

# Show version options
show_version_options() {
    CURRENT_VERSION=$(get_current_version)
    PACKAGE_NAME=$(get_package_name)

    echo
    log_info "Current version: $CURRENT_VERSION"
    log_info "Package: $PACKAGE_NAME"
    echo
    echo "Version bump options:"
    echo "1) patch - Bug fixes and minor changes (1.0.0 → 1.0.1)"
    echo "2) minor - New features, backward compatible (1.0.0 → 1.1.0)"
    echo "3) major - Breaking changes (1.0.0 → 2.0.0)"
    echo "4) custom - Specify custom version"
    echo "5) cancel - Exit without publishing"
    echo
}

# Get version bump type from user
get_version_bump() {
    while true; do
        read -p "Select version bump type (1-5): " choice
        case $choice in
            1)
                echo "patch"
                break
                ;;
            2)
                echo "minor"
                break
                ;;
            3)
                echo "major"
                break
                ;;
            4)
                read -p "Enter custom version (e.g., 1.2.3): " custom_version
                if [[ $custom_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    echo "custom:$custom_version"
                    break
                else
                    log_error "Invalid version format. Please use format X.Y.Z"
                fi
                ;;
            5)
                echo "cancel"
                break
                ;;
            *)
                log_error "Invalid choice. Please select 1-5"
                ;;
        esac
    done
}

# Bump version
bump_version() {
    local version_type=$1
    local new_version

    # Log to stderr so it doesn't interfere with stdout output
    log_info "Bumping version..." >&2

    if [[ "$version_type" == "custom:"* ]]; then
        # Custom version
        new_version=${version_type#custom:}
        npm version "$new_version" --no-git-tag-version --no-color --silent > /dev/null 2>&1
    else
        # Standard bump - completely suppress output and disable colors
        npm version "$version_type" --no-git-tag-version --no-color --silent > /dev/null 2>&1
    fi

    # Always get the version from package.json directly to avoid any npm output issues
    new_version=$(node -p "require('$PACKAGE_JSON').version")

    # Ensure we have a clean version
    if [[ ! "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "Invalid version format: $new_version" >&2
        exit 1
    fi

    log_success "Version bumped to: $new_version" >&2

    # Only output the clean version number to stdout
    echo "$new_version"
}

# Update changelog
update_changelog() {
    local new_version=$1
    local current_date=$(date +%Y-%m-%d)

    log_info "Updating changelog..."

    if [[ -f "$CHANGELOG" ]]; then
        # Create backup
        cp "$CHANGELOG" "$CHANGELOG.backup.$(date +%s)"

        # Update changelog
        if [[ -f "$CHANGELOG" ]]; then
            # Create a temporary file for the new content
            local temp_file=$(mktemp)

            # Process the changelog line by line
            local in_unreleased=false
            local version_added=false

            while IFS= read -r line; do
                if [[ "$line" == "## [Unreleased]" ]]; then
                    # Replace [Unreleased] with the new version
                    echo "## [$new_version] - $current_date" >> "$temp_file"
                    echo "" >> "$temp_file"
                    echo "## [Unreleased]" >> "$temp_file"
                    in_unreleased=true
                    version_added=true
                elif [[ "$line" == "- \*\*Future versions\*\*: Will be documented here as they are released" && "$version_added" == "true" ]]; then
                    # Update version history
                    echo "- **$new_version**: $(get_version_description $new_version)" >> "$temp_file"
                    echo "$line" >> "$temp_file"
                else
                    echo "$line" >> "$temp_file"
                fi
            done < "$CHANGELOG"

            # Replace the original file
            mv "$temp_file" "$CHANGELOG"

            # Clean up backup files
            rm -f "$CHANGELOG.bak"

            log_success "Changelog updated"
        fi
    else
        log_warning "CHANGELOG.md not found - skipping changelog update"
    fi
}

# Get version description based on version type
get_version_description() {
    local version=$1
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    local patch=$(echo "$version" | cut -d. -f3)

    if [[ "$patch" != "0" ]]; then
        echo "Patch release with bug fixes"
    elif [[ "$minor" != "0" ]]; then
        echo "Minor release with new features"
    else
        echo "Major release with breaking changes"
    fi
}

# Publish to npm
publish_to_npm() {
    local new_version=$1

    log_info "Publishing to npm..."

    # Check package contents
    log_info "Checking package contents..."
    npm pack --dry-run --no-color

    # Confirm publishing
    echo
    read -p "Ready to publish version $new_version to npm? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Publishing cancelled"
        exit 0
    fi

    # Publish
    if npm publish --no-color; then
        log_success "Successfully published $new_version to npm!"
    else
        log_error "Failed to publish to npm"
        exit 1
    fi
}

# Create git tag and push
create_git_tag() {
    local new_version=$1

    log_info "Creating git tag..."

    # Create tag
    if git tag -a "v$new_version" -m "Release version $new_version"; then
        log_success "Git tag v$new_version created"
    else
        log_error "Failed to create git tag"
        exit 1
    fi

    # Push tag
    log_info "Pushing tag to remote..."
    if git push origin "v$new_version"; then
        log_success "Tag pushed to remote"
    else
        log_warning "Failed to push tag to remote"
    fi

    # Commit version changes
    log_info "Committing version changes..."
    git add package.json package-lock.json
    if [[ -f "$CHANGELOG" ]]; then
        git add "$CHANGELOG"
    fi

    if git commit -m "Bump version to $new_version"; then
        log_success "Version changes committed"

        # Push changes
        log_info "Pushing changes to remote..."
        if git push origin "$(git branch --show-current)"; then
            log_success "Changes pushed to remote"
        else
            log_warning "Failed to push changes to remote"
        fi
    else
        log_warning "Failed to commit version changes"
    fi
}

# Show post-publishing information
show_post_publish_info() {
    local new_version=$1
    local package_name=$(get_package_name)

    echo
    log_success "🎉 Release $new_version published successfully!"
    echo
    echo "What's next:"
    echo "• Your package is now available on npm: https://www.npmjs.com/package/$package_name"
    echo "• Users can install it with: npm install -g $package_name@$new_version"
    echo "• Consider creating a GitHub release with the tag v$new_version"
    echo
    echo "Quick commands:"
    echo "• View package: npm view $package_name"
    echo "• Check downloads: npm stats $package_name"
    echo "• Update changelog: git log --oneline v$new_version..HEAD"
}

# Main function
main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Homebridge Plugin Publishing Script${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo

    # Run checks
    check_project_structure
    check_git_status
    check_npm_auth
    run_prepublish_checks

    # Show version options
    show_version_options

    # Get version bump choice
    version_choice=$(get_version_bump)

    if [[ "$version_choice" == "cancel" ]]; then
        log_info "Publishing cancelled"
        exit 0
    fi

    # Bump version
    local new_version=$(bump_version "$version_choice")

    # Update changelog
    update_changelog "$new_version"

    # Publish to npm
    publish_to_npm "$new_version"

    # Create git tag and push
    create_git_tag "$new_version"

    # Show post-publishing information
    show_post_publish_info "$new_version"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --patch        Bump patch version (1.0.0 → 1.0.1)"
        echo "  --minor        Bump minor version (1.0.0 → 1.1.0)"
        echo "  --major        Bump major version (1.0.0 → 2.0.0)"
        echo "  --auto         Auto-publish without prompts (use with care!)"
        echo
        echo "Examples:"
        echo "  $0              # Interactive mode"
        echo "  $0 --patch      # Quick patch release"
        echo "  $0 --minor      # Quick minor release"
        echo "  $0 --major      # Quick major release"
        exit 0
        ;;
    --patch)
        # Quick patch release
        check_project_structure
        check_git_status
        check_npm_auth
        run_prepublish_checks
        new_version=$(bump_version "patch")
        update_changelog "$new_version"
        publish_to_npm "$new_version"
        create_git_tag "$new_version"
        show_post_publish_info "$new_version"
        ;;
    --minor)
        # Quick minor release
        check_project_structure
        check_git_status
        check_npm_auth
        run_prepublish_checks
        new_version=$(bump_version "minor")
        update_changelog "$new_version"
        publish_to_npm "$new_version"
        create_git_tag "$new_version"
        show_post_publish_info "$new_version"
        ;;
    --major)
        # Quick major release
        check_project_structure
        check_git_status
        check_npm_auth
        run_prepublish_checks
        new_version=$(bump_version "major")
        update_changelog "$new_version"
        publish_to_npm "$new_version"
        create_git_tag "$new_version"
        show_post_publish_info "$new_version"
        ;;
    --auto)
        # Auto-publish mode (use with care!)
        log_warning "Auto-publish mode enabled - no prompts will be shown"
        check_project_structure
        check_git_status
        check_npm_auth
        run_prepublish_checks
        new_version=$(bump_version "patch")
        update_changelog "$new_version"
        publish_to_npm "$new_version"
        create_git_tag "$new_version"
        show_post_publish_info "$new_version"
        ;;
    "")
        # Interactive mode
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
