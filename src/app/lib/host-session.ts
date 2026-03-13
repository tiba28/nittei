import crypto from "crypto";

const HOST_SESSION_SECRET = process.env.HOST_SESSION_SECRET || "";

if (!HOST_SESSION_SECRET) {
    throw new Error("HOST_SESSION_SECRET is missing.");
}

export function getHostCookieName(eventId: string) {
    return `host_auth_${eventId}`;
}

export function signHostSession(eventId: string, password: string) {
    return crypto
        .createHmac("sha256", HOST_SESSION_SECRET)
        .update(`${eventId}:${password}`)
        .digest("hex");
}

export function safeEquals(a: string, b: string) {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}