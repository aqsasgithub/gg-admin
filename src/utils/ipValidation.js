/**
 * Shared IPv4 / IPv6 validation for Network Security target IPs.
 *
 * The backend (NetworkTargetService) is the source of truth and re-validates
 * every value, but validating client-side too gives instant inline feedback
 * and blocks obviously-bad submissions before a round-trip.
 *
 * Kept dependency-free (no `net`/`inet_pton` in the browser) using the same
 * rules the backend's filter_var(FILTER_VALIDATE_IP) accepts.
 */

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** True for a well-formed dotted-quad IPv4 literal. */
export function isValidIPv4(value) {
    return IPV4_RE.test(String(value).trim());
}

/**
 * True for a well-formed IPv6 literal (full, compressed `::`, and
 * IPv4-mapped forms like ::ffff:192.0.2.1). Rejects zone IDs / CIDR / ports.
 */
export function isValidIPv6(value) {
    const v = String(value).trim();
    if (v.indexOf(':') === -1) return false;

    // Split off an optional trailing IPv4 tail (IPv4-mapped IPv6).
    const parts = v.split(':');
    const last = parts[parts.length - 1];
    const hasV4Tail = last.indexOf('.') !== -1;
    if (hasV4Tail && !isValidIPv4(last)) return false;

    // Normalise the "::" compression into the right number of zero groups.
    const doubleColon = v.match(/::/g);
    if (doubleColon && doubleColon.length > 1) return false; // only one "::"

    const maxGroups = 8;
    const v4TakesTwo = hasV4Tail ? 2 : 0;
    const groups = v.replace(/::/, ':').split(':').filter((g) => g !== '');
    const explicitHexGroups = hasV4Tail ? groups.length - 1 : groups.length;

    // Each non-tail group must be 1–4 hex digits.
    const hexOk = (hasV4Tail ? groups.slice(0, -1) : groups)
        .every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
    if (!hexOk) return false;

    const totalGroups = explicitHexGroups + v4TakesTwo;
    if (doubleColon) {
        // "::" must stand in for at least one zero group.
        return totalGroups <= maxGroups - 1 || (totalGroups === maxGroups && (v === '::'));
    }
    return totalGroups === maxGroups;
}

/** Returns 4, 6, or null. */
export function detectIpVersion(value) {
    if (isValidIPv4(value)) return 4;
    if (isValidIPv6(value)) return 6;
    return null;
}

/**
 * Validate a single target IP for the manager UI.
 * @returns {{ valid: boolean, version: (4|6|null), message: (string|null) }}
 */
export function validateTargetIp(value) {
    const v = String(value ?? '').trim();
    if (!v) return { valid: false, version: null, message: 'Enter an IP address.' };
    const version = detectIpVersion(v);
    if (!version) {
        return { valid: false, version: null, message: 'Enter a valid IPv4 or IPv6 address.' };
    }
    return { valid: true, version, message: null };
}

/**
 * Duplicate check against an existing list of targets (client-side guard;
 * the backend also enforces a unique index). Compares trimmed, lower-cased.
 */
export function isDuplicateIp(value, existing = [], excludeId = null) {
    const needle = String(value).trim().toLowerCase();
    return existing.some(
        (t) => t.id !== excludeId && String(t.ip_address).trim().toLowerCase() === needle,
    );
}
