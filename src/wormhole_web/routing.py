"""Generic consistent-hashing code router.

Maps wormhole codes to machine/instance IDs using a ketama-style
hash ring (via uhashring).  No Fly-specific logic lives here.
"""

from uhashring import HashRing


class CodeRouter:
    """Route wormhole codes to nodes via consistent hashing."""

    def __init__(self, nodes):
        """Create a router for the given node IDs.

        Args:
            nodes: iterable of machine/instance ID strings.
        """
        self._ring = HashRing(nodes=nodes)
        self._nodes = list(nodes)

    def get_target(self, code):
        """Return the node ID that should own *code*."""
        return self._ring.get_node(code)

    def should_handle(self, code, my_id):
        """Return True if *my_id* is the owner of *code*."""
        return self.get_target(code) == my_id

    def update_nodes(self, nodes):
        """Replace the node set (e.g. after a scale event)."""
        self._ring = HashRing(nodes=nodes)
        self._nodes = list(nodes)
