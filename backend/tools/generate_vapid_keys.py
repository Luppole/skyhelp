"""
Generate VAPID key pair for Web Push notifications.

Usage:
    python -m backend.tools.generate_vapid_keys

Outputs keys ready to paste into .env files.
Requires pywebpush (already in requirements.txt).
"""

import base64
import os


def main():
    try:
        from cryptography.hazmat.primitives.asymmetric import ec  # type: ignore[import-untyped]
        from cryptography.hazmat.primitives.serialization import (  # type: ignore[import-untyped]
            Encoding, PublicFormat, PrivateFormat, NoEncryption,
        )
    except ImportError:
        print("ERROR: cryptography package not found. Install pywebpush first:")
        print("  pip install pywebpush")
        return

    # Generate EC P-256 key (required for VAPID)
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key  = private_key.public_key()

    priv_bytes = private_key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    pub_bytes  = public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)

    priv_b64 = base64.urlsafe_b64encode(priv_bytes).decode().rstrip('=')
    pub_b64  = base64.urlsafe_b64encode(pub_bytes).decode().rstrip('=')

    print()
    print("=== VAPID Keys Generated ===")
    print()
    print("── backend/.env ────────────────────────────────")
    print(f"VAPID_PRIVATE_KEY={priv_b64}")
    print(f"VAPID_PUBLIC_KEY={pub_b64}")
    print( "VAPID_EMAIL=mailto:you@yourdomain.com")
    print()
    print("── frontend .env.local ─────────────────────────")
    print(f"VITE_VAPID_PUBLIC_KEY={pub_b64}")
    print()
    print("The public key must be IDENTICAL in both files.")
    print("Never commit VAPID_PRIVATE_KEY to version control!")
    print()


if __name__ == '__main__':
    main()
