"""Wormhole receive logic — stream a file from a wormhole sender."""

from twisted.internet import defer
from wormhole import create
from wormhole.transit import TransitReceiver
from wormhole.util import dict_to_bytes, bytes_to_dict

from wormhole_web.constants import APPID, RELAY_URL, TRANSIT_RELAY, TRANSIT_KEY_LENGTH
from wormhole_web.util import WormholeTimeout, with_timeout


class ReceiveError(Exception):
    """Base error for receive failures."""


class BadCodeError(ReceiveError):
    """The wormhole code was invalid or expired."""


class OfferError(ReceiveError):
    """The offer was not a file offer or was malformed."""


class FileOffer:
    """Metadata from a wormhole file offer."""
    def __init__(self, filename: str, filesize: int):
        self.filename = filename
        self.filesize = filesize


@defer.inlineCallbacks
def receive_file(code: str, reactor, timeout=120):
    """Initiate a wormhole receive and return (offer, transit_connection, wormhole).

    The caller is responsible for reading data from the transit connection
    and closing the wormhole when done.

    Args:
        code: The wormhole code to receive from.
        reactor: The Twisted reactor.
        timeout: Seconds to wait before giving up.

    Returns:
        tuple: (FileOffer, Connection, wormhole_object)

    Raises:
        BadCodeError: If the code is invalid or PAKE fails.
        OfferError: If the offer is not a single-file offer.
        WormholeTimeout: If the operation times out.
    """
    w = create(APPID, RELAY_URL, reactor)
    timed_out = [False]
    try:
        w.set_code(code)

        # Wait for key exchange (with timeout)
        try:
            yield with_timeout(
                w.get_unverified_key(), timeout, reactor,
                "Timed out waiting for sender"
            )
        except WormholeTimeout:
            timed_out[0] = True
            raise
        except Exception as e:
            raise BadCodeError(f"Key exchange failed: {e}") from e

        yield w.get_verifier()

        # Set up transit receiver
        tr = TransitReceiver(
            TRANSIT_RELAY,
            no_listen=True,  # server doesn't accept inbound connections
            reactor=reactor,
        )

        transit_key = w.derive_key(APPID + "/transit-key", TRANSIT_KEY_LENGTH)
        tr.set_transit_key(transit_key)

        # Read two messages: transit hints and file offer (either order)
        msg1_bytes = yield with_timeout(
            w.get_message(), timeout, reactor, "Timed out waiting for offer"
        )
        msg1 = bytes_to_dict(msg1_bytes)
        msg2_bytes = yield with_timeout(
            w.get_message(), timeout, reactor, "Timed out waiting for offer"
        )
        msg2 = bytes_to_dict(msg2_bytes)

        # Sort out which is which
        transit_msg = None
        offer_msg = None
        for msg in (msg1, msg2):
            if "transit" in msg:
                transit_msg = msg
            elif "offer" in msg:
                offer_msg = msg

        if transit_msg is None:
            raise OfferError("Never received transit hints message")
        if offer_msg is None:
            raise OfferError("Never received file offer message")

        # Send our transit hints
        our_abilities = tr.get_connection_abilities()
        our_hints = yield tr.get_connection_hints()
        w.send_message(dict_to_bytes({
            "transit": {
                "abilities-v1": our_abilities,
                "hints-v1": our_hints,
            }
        }))

        # Add peer's hints
        tr.add_connection_hints(transit_msg["transit"].get("hints-v1", []))

        # Parse the file offer
        offer = offer_msg["offer"]
        if "file" not in offer:
            raise OfferError(
                f"Only single-file offers are supported, got: {list(offer.keys())}"
            )

        file_offer = FileOffer(
            filename=offer["file"]["filename"],
            filesize=offer["file"]["filesize"],
        )

        # Send file_ack
        w.send_message(dict_to_bytes({
            "answer": {"file_ack": "ok"}
        }))

        # Establish transit connection (with timeout)
        connection = yield with_timeout(
            tr.connect(), timeout, reactor, "Timed out establishing transit"
        )

        defer.returnValue((file_offer, connection, w))
    except ReceiveError:
        yield w.close()
        raise
    except Exception as e:
        yield w.close()
        if timed_out[0]:
            raise
        raise ReceiveError(f"Receive failed: {e}") from e
