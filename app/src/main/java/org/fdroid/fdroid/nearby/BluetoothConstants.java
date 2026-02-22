package org.fdroid.fdroid.nearby;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * We need some shared information between the client and the server app.
 */
public class BluetoothConstants {

    /**
     * Device names that are blocked from connecting or being discovered via any nearby channel.
     */
    public static final Set<String> BLOCKED_DEVICE_NAMES = Collections.unmodifiableSet(
            new HashSet<>(Arrays.asList("JOHNCHARLESMONTI")));

    static UUID fdroidUuid() {
        // TODO: Generate a UUID deterministically from, e.g. "org.fdroid.fdroid.net.Bluetooth";
        // This can be an offline process, as long as it can be reproduced by other people who
        // want to do so.
        // This UUID is just from mashing random hex characters on the keyboard.
        return UUID.fromString("cd59ba31-5729-b3bb-cb29-732b59eb61aa");
    }
}
