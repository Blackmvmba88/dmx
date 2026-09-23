import unittest

from dmx_router import DMXFrame, DualUniverseRouter, RoutingMode


class DMXFrameTests(unittest.TestCase):
    def test_default_frame_is_blackout(self):
        self.assertEqual(DMXFrame().values, [0] * 512)

    def test_set_channel_uses_one_based_indexing(self):
        frame = DMXFrame()
        frame.set_channel(1, 255)
        frame.set_channel(512, 128)
        self.assertEqual(frame.values[0], 255)
        self.assertEqual(frame.values[-1], 128)

    def test_rejects_invalid_channel(self):
        with self.assertRaises(ValueError):
            DMXFrame().set_channel(0, 1)

    def test_rejects_invalid_value(self):
        with self.assertRaises(ValueError):
            DMXFrame().set_channel(1, 256)


class DualUniverseRouterTests(unittest.TestCase):
    def setUp(self):
        self.frame = DMXFrame()
        self.frame.set_channel(1, 200)

    def test_primary_routes_only_to_a(self):
        out = DualUniverseRouter(RoutingMode.PRIMARY).route(self.frame)
        self.assertEqual(out["A"].values[0], 200)
        self.assertEqual(out["B"].values[0], 0)

    def test_mirror_copies_to_both(self):
        out = DualUniverseRouter(RoutingMode.MIRROR).route(self.frame)
        self.assertEqual(out["A"].values, out["B"].values)
        self.assertIsNot(out["A"].values, out["B"].values)

    def test_failover_moves_frame_to_b(self):
        out = DualUniverseRouter(RoutingMode.FAILOVER).route(
            self.frame, primary_healthy=False
        )
        self.assertEqual(out["A"].values[0], 0)
        self.assertEqual(out["B"].values[0], 200)

    def test_emergency_blackout_blanks_both(self):
        out = DualUniverseRouter.emergency_blackout()
        self.assertEqual(out["A"].values, [0] * 512)
        self.assertEqual(out["B"].values, [0] * 512)


if __name__ == "__main__":
    unittest.main()
