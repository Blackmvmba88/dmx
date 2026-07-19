export interface FixtureProfile {
    name: string;
    channels: number;
    mapping: {
        dimmer?: number;
        red?: number;
        green?: number;
        blue?: number;
        white?: number;
        amber?: number;
        uv?: number;
        strobe?: number;
        macro?: number;
        speed?: number;
        [key: string]: number | undefined;
    };
}
export interface Fixture {
    id: string;
    name: string;
    universe: number;
    address: number;
    channels: number;
    profile: FixtureProfile;
}
export interface DMXChannelChange {
    channel: number;
    value: number;
}
