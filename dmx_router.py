"""Pure DMX routing primitives.

This module intentionally contains no USB/hardware I/O so it can be tested
without fixtures connected.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List

DMX_CHANNELS = 512
DMX_MIN = 0
DMX_MAX = 255


class RoutingMode(str, Enum):
    PRIMARY = "primary"
    MIRROR = "mirror"
    FAILOVER = "failover"


def _validate_value(value: int) -> int:
    if not isinstance(value, int):
        raise TypeError("DMX values must be integers")
    if not DMX_MIN <= value <= DMX_MAX:
        raise ValueError("DMX value must be between 0 and 255")
    return value


@dataclass
class DMXFrame:
    values: List[int] = field(default_factory=lambda: [0] * DMX_CHANNELS)

    def __post_init__(self) -> None:
        if len(self.values) != DMX_CHANNELS:
            raise ValueError(f"DMX frame must contain {DMX_CHANNELS} channels")
        self.values = [_validate_value(v) for v in self.values]

    def set_channel(self, channel: int, value: int) -> None:
        if not 1 <= channel <= DMX_CHANNELS:
            raise ValueError("DMX channel must be between 1 and 512")
        self.values[channel - 1] = _validate_value(value)

    @classmethod
    def blackout(cls) -> "DMXFrame":
        return cls()

    def clone(self) -> "DMXFrame":
        return DMXFrame(self.values.copy())


@dataclass
class DualUniverseRouter:
    mode: RoutingMode = RoutingMode.PRIMARY

    def route(self, frame: DMXFrame, *, primary_healthy: bool = True) -> Dict[str, DMXFrame]:
        """Return frames for logical universes A and B.

        PRIMARY:
            A carries the frame, B is blacked out.
        MIRROR:
            A and B carry identical independent copies.
        FAILOVER:
            A carries the frame while healthy; otherwise B carries it.
        """
        blackout = DMXFrame.blackout()

        if self.mode == RoutingMode.PRIMARY:
            return {"A": frame.clone(), "B": blackout}

        if self.mode == RoutingMode.MIRROR:
            return {"A": frame.clone(), "B": frame.clone()}

        if self.mode == RoutingMode.FAILOVER:
            if primary_healthy:
                return {"A": frame.clone(), "B": blackout}
            return {"A": blackout, "B": frame.clone()}

        raise ValueError(f"Unsupported routing mode: {self.mode}")

    @staticmethod
    def emergency_blackout() -> Dict[str, DMXFrame]:
        return {"A": DMXFrame.blackout(), "B": DMXFrame.blackout()}
