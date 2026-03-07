#!/usr/bin/env bash
# MONTI-DROID Termux Installer
# Uses the JOHNCHARLESMONTI.COM Direct Human Connection to obtain
# the proper Linux installation codes for Android (via Termux).
#
# Usage (inside Termux on Android):
#   bash install-termux.sh
#
# Requirements: Termux – https://f-droid.org/packages/com.termux/

set -euo pipefail

MONTI_API="https://www.johncharlesmonti.com/api/install-codes"
MONTI_REPO="https://github.com/montinode/MONTI-DROID"
REQUIRED_PACKAGES=(git openjdk-17 wget curl)

# ── helpers ──────────────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[MONTI]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[ERR ]\033[0m %s\n' "$*" >&2; exit 1; }

# ── environment check ─────────────────────────────────────────────────────────

check_termux() {
    if [[ -z "${TERMUX_VERSION:-}" && ! -d "/data/data/com.termux" ]]; then
        warn "This script is designed to run inside Termux on Android."
        warn "Continuing anyway, but some steps may not apply."
    else
        ok "Termux environment detected (version: ${TERMUX_VERSION:-unknown})"
    fi
}

# ── JOHNCHARLESMONTI.COM connection ───────────────────────────────────────────

fetch_install_codes() {
    log "Connecting to JOHNCHARLESMONTI.COM for installation codes …"

    local response
    if command -v curl &>/dev/null; then
        response=$(curl -fsSL \
            -H "X-MONTI-Platform: android-termux" \
            -H "X-MONTI-Version: $(cat VERSION 2>/dev/null || echo 'latest')" \
            "${MONTI_API}" 2>/dev/null) || true
    elif command -v wget &>/dev/null; then
        response=$(wget -qO- \
            --header="X-MONTI-Platform: android-termux" \
            "${MONTI_API}" 2>/dev/null) || true
    fi

    if [[ -n "${response:-}" ]]; then
        ok "Installation codes received from JOHNCHARLESMONTI.COM"
        # Write codes to a local file for reference
        printf '%s\n' "${response}" > /tmp/monti-install-codes.txt
        ok "Codes saved to /tmp/monti-install-codes.txt"
    else
        warn "Could not reach ${MONTI_API} – using bundled defaults."
    fi
}

# ── package installation ───────────────────────────────────────────────────────

install_packages() {
    log "Updating Termux package index …"
    pkg update -y

    log "Installing required packages: ${REQUIRED_PACKAGES[*]}"
    pkg install -y "${REQUIRED_PACKAGES[@]}" \
        && ok "Packages installed." \
        || warn "Some packages could not be installed – build may fail."
}

# ── Android storage setup ─────────────────────────────────────────────────────

setup_storage() {
    log "Setting up Termux storage access …"
    if [[ ! -d "${HOME}/storage" ]]; then
        termux-setup-storage 2>/dev/null \
            && ok "Storage access configured." \
            || warn "termux-setup-storage not available – skipping."
    else
        ok "Storage already configured."
    fi
}

# ── clone / update repo ────────────────────────────────────────────────────────

setup_repo() {
    local dest="${HOME}/monti-droid"
    if [[ -d "${dest}/.git" ]]; then
        log "Updating existing MONTI-DROID checkout …"
        git -C "${dest}" pull --ff-only
    else
        log "Cloning MONTI-DROID repository …"
        git clone "${MONTI_REPO}" "${dest}"
    fi
    ok "MONTI-DROID source is at: ${dest}"
}

# ── Gradle wrapper shortcut ────────────────────────────────────────────────────

build_apk() {
    local dest="${HOME}/monti-droid"
    log "Building MONTI-DROID APK (this may take several minutes) …"
    cd "${dest}"
    chmod +x gradlew
    ./gradlew assembleDebug \
        && ok "APK built: ${dest}/app/build/outputs/apk/debug/app-debug.apk" \
        || die "Gradle build failed. Check the output above for details."
}

# ── main ───────────────────────────────────────────────────────────────────────

main() {
    log "=========================================================="
    log " MONTI-DROID  –  Termux / Android Installer"
    log "=========================================================="
    echo

    check_termux
    fetch_install_codes
    install_packages
    setup_storage
    setup_repo

    echo
    read -rp "Build APK now? [y/N] " build_now
    if [[ "${build_now,,}" == "y" ]]; then
        build_apk
    else
        log "Skipping build. Run './gradlew assembleDebug' inside ~/monti-droid when ready."
    fi

    echo
    ok "MONTI-DROID Termux setup complete!"
    log "Visit https://www.johncharlesmonti.com for further instructions."
}

main "$@"
