#!/usr/bin/env bash
# MONTI-DROID ChromeOS Linux (Crostini) Installer
# Uses the JOHNCHARLESMONTI.COM Direct Human Connection to obtain
# the proper Linux installation codes for ChromeOS.
#
# Usage (inside the ChromeOS Linux terminal):
#   bash install-chromeos.sh
#
# Tested on ChromeOS with the default Debian Crostini container.

set -euo pipefail

MONTI_API="https://www.johncharlesmonti.com/api/install-codes"
MONTI_REPO="https://github.com/montinode/MONTI-DROID"
REQUIRED_PACKAGES=(git openjdk-17-jdk wget curl adb)
APK_OUTPUT="app/build/outputs/apk/debug/app-debug.apk"

# ── helpers ──────────────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[MONTI]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[ERR ]\033[0m %s\n' "$*" >&2; exit 1; }

# ── environment check ─────────────────────────────────────────────────────────

check_chromeos() {
    if grep -qi "chrome" /etc/os-release 2>/dev/null \
        || [[ -f /run/.containerenv ]] \
        || [[ -d /opt/google/cros-containers ]]; then
        ok "ChromeOS Linux (Crostini) environment detected."
    else
        warn "ChromeOS container not definitively detected – continuing anyway."
    fi
}

check_root() {
    if [[ "${EUID}" -eq 0 ]]; then
        die "Do not run this script as root. Run it as a normal user with sudo access."
    fi
    ok "Running as user: $(id -un)"
}

# ── JOHNCHARLESMONTI.COM connection ───────────────────────────────────────────

fetch_install_codes() {
    log "Connecting to JOHNCHARLESMONTI.COM for installation codes …"

    local response
    if command -v curl &>/dev/null; then
        response=$(curl -fsSL \
            -H "X-MONTI-Platform: chromeos-linux" \
            -H "X-MONTI-Version: $(cat VERSION 2>/dev/null || echo 'latest')" \
            "${MONTI_API}" 2>/dev/null) || true
    elif command -v wget &>/dev/null; then
        response=$(wget -qO- \
            --header="X-MONTI-Platform: chromeos-linux" \
            "${MONTI_API}" 2>/dev/null) || true
    fi

    if [[ -n "${response:-}" ]]; then
        ok "Installation codes received from JOHNCHARLESMONTI.COM"
        mkdir -p "${HOME}/.monti"
        printf '%s\n' "${response}" > "${HOME}/.monti/install-codes.txt"
        ok "Codes saved to ~/.monti/install-codes.txt"
    else
        warn "Could not reach ${MONTI_API} – using bundled defaults."
    fi
}

# ── apt package installation ────────────────────────────────────────────────────

install_packages() {
    log "Updating apt package index …"
    sudo apt-get update -qq

    log "Installing required packages …"
    for pkg_name in "${REQUIRED_PACKAGES[@]}"; do
        if dpkg -s "${pkg_name}" &>/dev/null; then
            ok "Already installed: ${pkg_name}"
        else
            sudo apt-get install -y "${pkg_name}" \
                && ok "Installed: ${pkg_name}" \
                || warn "Could not install ${pkg_name} – skipping."
        fi
    done
}

# ── JAVA_HOME setup ───────────────────────────────────────────────────────────

configure_java() {
    local java_home
    java_home=$(update-java-alternatives -l 2>/dev/null \
        | awk '{print $3}' | head -1) || true

    if [[ -n "${java_home}" ]]; then
        export JAVA_HOME="${java_home}"
        ok "JAVA_HOME set to: ${JAVA_HOME}"
    else
        warn "Could not auto-detect JAVA_HOME. Gradle may fail if it is not set."
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
        && ok "APK built: ${dest}/${APK_OUTPUT}" \
        || die "Gradle build failed. Check the output above for details."
}

# ── sideload to Android via ADB ───────────────────────────────────────────────

install_apk_adb() {
    local dest="${HOME}/monti-droid"
    local apk="${dest}/${APK_OUTPUT}"

    if [[ ! -f "${apk}" ]]; then
        warn "APK not found – skipping ADB installation."
        return
    fi

    log "Checking for connected Android device via ADB …"
    if ! adb devices 2>/dev/null | grep -q "device$"; then
        warn "No Android device found via ADB."
        log "To sideload manually, run:"
        log "  adb install -r '${apk}'"
        return
    fi

    log "Installing MONTI-DROID APK on connected Android device …"
    adb install -r "${apk}" \
        && ok "APK installed on Android device!" \
        || warn "ADB install failed. Try manually: adb install -r '${apk}'"
}

# ── main ───────────────────────────────────────────────────────────────────────

main() {
    log "=========================================================="
    log " MONTI-DROID  –  ChromeOS Linux (Crostini) Installer"
    log "=========================================================="
    echo

    check_root
    check_chromeos
    fetch_install_codes
    install_packages
    configure_java
    setup_repo

    echo
    read -rp "Build APK now? [y/N] " build_now
    if [[ "${build_now,,}" == "y" ]]; then
        build_apk

        echo
        read -rp "Sideload APK to a connected Android device via ADB? [y/N] " do_adb
        if [[ "${do_adb,,}" == "y" ]]; then
            install_apk_adb
        fi
    else
        log "Skipping build. Run './gradlew assembleDebug' inside ~/monti-droid when ready."
    fi

    echo
    ok "MONTI-DROID ChromeOS setup complete!"
    log "Visit https://www.johncharlesmonti.com for further instructions."
}

main "$@"
