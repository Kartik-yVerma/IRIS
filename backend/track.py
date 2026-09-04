"""IRIS — track geometry: route polyline, chainage math, stations, zones, segments.

The route is modelled as a Catmull-Rom spline through station waypoints along
the Mumbai–Pune corridor. Chainage = distance in metres along the polyline from
the route origin. All positions snap to this geometry (PRD FR-401/FR-404).
"""
import math

import numpy as np

# ---------------------------------------------------------------- waypoints
# (name, lat, lng) — real geography so the live map overlays real terrain.
WAYPOINTS = [
    ("CSMT", 18.9402, 72.8355),
    ("Dadar", 19.0181, 72.8414),
    ("Thane", 19.1863, 72.9752),
    ("Kalyan", 19.2353, 73.1314),
    ("Karjat", 18.9110, 73.3301),
    ("Khandala", 18.7548, 73.3703),
    ("Lonavala", 18.7546, 73.4053),
    ("Talegaon", 18.7378, 73.6787),
    ("Shivajinagar", 18.5311, 73.8490),
]

# Operational zones = station pairs (used for health rollups, PRD §11).
ZONE_SPANS = [
    ("Metro Corridor", "CSMT", "Kalyan"),
    ("Foothills", "Kalyan", "Karjat"),
    ("Ghat Section", "Karjat", "Lonavala"),
    ("Plateau", "Lonavala", "Shivajinagar"),
]

SEGMENT_LENGTH_M = 250.0      # track segment granularity (S-001, S-002, …)
SAMPLE_SPACING_M = 5.0        # polyline sampling density

# The rover patrols the Ghat Section — the high-maintenance hotspot.
PATROL_ZONE = "Ghat Section"

EARTH_R = 6371000.0


def _haversine(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_R * math.asin(math.sqrt(a))


def _catmull_rom(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    f = np.array([-0.5, 1.5, -1.5, 0.5]) * t3 + np.array([1.0, -2.5, 2.0, -0.5]) * t2 \
        + np.array([-0.5, 0.0, 0.5, 0.0]) * t + np.array([0.0, 1.0, 0.0, 0.0])
    return f[0] * p0 + f[1] * p1 + f[2] * p2 + f[3] * p3


class Track:
    """Route geometry: dense polyline + cumulative chainage + lookup helpers."""

    def __init__(self):
        self.waypoints = [{"name": n, "lat": la, "lng": lo} for n, la, lo in WAYPOINTS]
        self._build()

    # ------------------------------------------------------------- geometry
    def _build(self):
        wps = np.array([[la, lo] for _, la, lo in WAYPOINTS], dtype=float)
        pts = [wps[0]]
        # Catmull-Rom between consecutive waypoints, density ∝ segment length
        for i in range(len(wps) - 1):
            d = _haversine(wps[i][0], wps[i][1], wps[i + 1][0], wps[i + 1][1])
            n = max(4, int(round(d / SAMPLE_SPACING_M)))
            p0 = wps[max(0, i - 1)]
            p3 = wps[min(len(wps) - 1, i + 2)]
            for k in range(1, n + 1):
                pts.append(_catmull_rom(p0, wps[i], wps[i + 1], p3, k / n))
        self.points = np.array(pts)                     # (N,2) lat,lng
        # cumulative chainage
        dist = np.array([
            _haversine(a[0], a[1], b[0], b[1])
            for a, b in zip(self.points[:-1], self.points[1:])
        ])
        self.cum = np.concatenate([[0.0], np.cumsum(dist)])
        self.total_m = float(self.cum[-1])

        # stations
        self.stations = []
        for name, la, lo in WAYPOINTS:
            i = np.argmin(np.sum((self.points - [la, lo]) ** 2, axis=1))
            self.stations.append({
                "name": name,
                "chainage_m": round(float(self.cum[i]), 1),
                "lat": float(self.points[i][0]),
                "lng": float(self.points[i][1]),
            })

        # zones
        st = {s["name"]: s["chainage_m"] for s in self.stations}
        self.zones = []
        for zid, (name, a, b) in enumerate(ZONE_SPANS):
            z = {
                "id": f"Z{zid + 1}",
                "name": name,
                "start_m": st[a],
                "end_m": st[b],
            }
            self.zones.append(z)
        self.zone_by_name = {z["name"]: z for z in self.zones}
        patrol = self.zone_by_name[PATROL_ZONE]
        # demo patrol window: a 10 km stretch of the Ghat Section so a full
        # out-and-back loop completes in a few minutes (visible turnarounds)
        self.patrol = {"zone": PATROL_ZONE, "start_m": 100000.0,
                       "end_m": 110000.0,
                       "window_label": "Ghat Section · km 100–110"}

        # segments S-001…
        self.segments = []
        nseg = int(self.total_m // SEGMENT_LENGTH_M) + 1
        for i in range(nseg):
            self.segments.append({
                "id": f"S-{i + 1:03d}",
                "start_m": i * SEGMENT_LENGTH_M,
                "end_m": min((i + 1) * SEGMENT_LENGTH_M, self.total_m),
            })

    # -------------------------------------------------------------- lookups
    def chainage_to_latlng(self, m):
        """Point on the polyline at chainage m (clamped)."""
        m = float(np.clip(m, 0.0, self.total_m))
        i = int(np.searchsorted(self.cum, m)) - 1
        i = max(0, min(i, len(self.points) - 2))
        seg_len = self.cum[i + 1] - self.cum[i]
        t = 0.0 if seg_len == 0 else (m - self.cum[i]) / seg_len
        p = self.points[i] * (1 - t) + self.points[i + 1] * t
        return float(p[0]), float(p[1])

    def latlng_to_chainage(self, lat, lng):
        """Nearest chainage to a coordinate (snap-to-track, FR-401)."""
        d = np.sum((self.points - [lat, lng]) ** 2, axis=1)
        return float(self.cum[int(np.argmin(d))])

    def offset_latlng(self, m, lateral_m):
        """Point offset laterally (metres, + = right of travel) at chainage m."""
        lat, lng = self.chainage_to_latlng(m)
        i = int(np.searchsorted(self.cum, m)) - 1
        i = max(0, min(i, len(self.points) - 2))
        a, b = self.points[i], self.points[i + 1]
        dy, dx = (b[0] - a[0]), (b[1] - a[1]) * math.cos(math.radians(lat))
        norm = math.hypot(dx, dy) or 1e-9
        # perpendicular (right-hand side)
        px, py = dy / norm, -dx / norm
        dlat = lateral_m * px / 111320.0
        dlng = lateral_m * py / (111320.0 * math.cos(math.radians(lat)))
        return lat + dlat, lng + dlng

    def bearing_at(self, m, direction=1):
        """Compass bearing (deg, 0=N) of the track at chainage m."""
        a = self.chainage_to_latlng(m)
        b = self.chainage_to_latlng(m + 25.0 * direction)
        lat1, lng1 = math.radians(a[0]), math.radians(a[1])
        lat2, lng2 = math.radians(b[0]), math.radians(b[1])
        dlon = lng2 - lng1
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0

    def zone_at(self, m):
        for z in self.zones:
            if z["start_m"] <= m <= z["end_m"]:
                return z
        return self.zones[0]

    def segment_at(self, m):
        i = int(m // SEGMENT_LENGTH_M)
        return self.segments[max(0, min(i, len(self.segments) - 1))]["id"]


TRACK = Track()

# frame capture cadence: one synthetic camera frame every N metres of patrol
FRAME_INTERVAL_M = 200.0


def frame_chainage(frame_idx):
    """Chainage at which frame `frame_idx` is captured along the patrol."""
    start = TRACK.patrol["start_m"]
    span = TRACK.patrol["end_m"] - start
    n_frames = int(span // FRAME_INTERVAL_M)
    return start + (frame_idx % n_frames) * FRAME_INTERVAL_M


def patrol_frame_count():
    span = TRACK.patrol["end_m"] - TRACK.patrol["start_m"]
    return int(span // FRAME_INTERVAL_M)
