"""Shared constants for wormhole-web."""

APPID = "lothar.com/wormhole/text-or-file-xfer"
RELAY_URL = "ws://relay.magic-wormhole.io:4000/v1"
TRANSIT_RELAY = "tcp:transit.magic-wormhole.io:4001"
TRANSIT_KEY_LENGTH = 32  # SecretBox.KEY_SIZE

DEFAULT_PORT = 8080
DEFAULT_MAX_SESSIONS = 128
DEFAULT_SESSION_TTL = 60
DEFAULT_TRANSFER_TIMEOUT = 120
