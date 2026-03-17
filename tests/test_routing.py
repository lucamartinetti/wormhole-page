"""Unit tests for the generic CodeRouter."""

from twisted.trial import unittest

from wormhole_web.routing import CodeRouter


class TestCodeRouterDeterministic(unittest.TestCase):
    """Same code always maps to the same node."""

    def test_same_code_same_node(self):
        nodes = ["machine-a", "machine-b", "machine-c"]
        router = CodeRouter(nodes)
        code = "7-guitarist-revenge"
        first = router.get_target(code)
        for _ in range(100):
            self.assertEqual(router.get_target(code), first)

    def test_different_codes_distribute(self):
        nodes = ["machine-a", "machine-b", "machine-c"]
        router = CodeRouter(nodes)
        targets = {router.get_target(f"code-{i}") for i in range(200)}
        # With 200 codes and 3 nodes, all nodes should receive at least one
        self.assertEqual(targets, set(nodes))


class TestCodeRouterConsistent(unittest.TestCase):
    """Adding a node remaps only ~1/N codes."""

    def test_adding_node_remaps_few_codes(self):
        nodes_3 = ["a", "b", "c"]
        nodes_4 = ["a", "b", "c", "d"]
        router_3 = CodeRouter(nodes_3)
        router_4 = CodeRouter(nodes_4)

        total = 1000
        remapped = 0
        for i in range(total):
            code = f"test-code-{i}"
            if router_3.get_target(code) != router_4.get_target(code):
                remapped += 1

        # Expect ~1/4 = 25% remapped.  Allow generous range [5%, 50%].
        ratio = remapped / total
        self.assertGreater(ratio, 0.05, f"Too few remapped: {ratio:.2%}")
        self.assertLess(ratio, 0.50, f"Too many remapped: {ratio:.2%}")


class TestShouldHandle(unittest.TestCase):
    def test_should_handle_true_for_owner(self):
        router = CodeRouter(["a", "b", "c"])
        code = "7-guitarist-revenge"
        owner = router.get_target(code)
        self.assertTrue(router.should_handle(code, owner))

    def test_should_handle_false_for_non_owner(self):
        router = CodeRouter(["a", "b", "c"])
        code = "7-guitarist-revenge"
        owner = router.get_target(code)
        others = [n for n in ["a", "b", "c"] if n != owner]
        for other in others:
            self.assertFalse(router.should_handle(code, other))


class TestUpdateNodes(unittest.TestCase):
    def test_update_changes_ring(self):
        router = CodeRouter(["a", "b"])
        # After updating to a single node, everything maps there
        router.update_nodes(["only-node"])
        for i in range(50):
            self.assertEqual(router.get_target(f"code-{i}"), "only-node")


class TestEdgeCases(unittest.TestCase):
    def test_single_node(self):
        router = CodeRouter(["solo"])
        self.assertEqual(router.get_target("any-code"), "solo")
        self.assertTrue(router.should_handle("any-code", "solo"))

    def test_empty_nodes_returns_none(self):
        router = CodeRouter([])
        # uhashring returns None when ring is empty
        self.assertIsNone(router.get_target("any-code"))
