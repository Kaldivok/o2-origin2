import random
import math
from dataclasses import dataclass

SEED = 20261120
random.seed(SEED)

@dataclass
class Monster:
    name: str
    hp: float
    att: float
    defn: float
    agi: float
    growth: float
    trains: int
    spec: str

def build_historical_monster(spec: str, trains: int, growth: float) -> Monster:
    hp, att, defn, agi = 80.0, 18.0, 16.0, 16.0
    g_mult = growth / 6.25
    gain = 88.0 * (1.0 - math.exp(-trains / 380.0)) * g_mult
    penalty = 12.0 * (1.0 - math.exp(-trains / 900.0))
    if spec == "ATT":
        att += gain
        defn = max(5.0, defn - penalty * 0.5 + 14.0 * (1.0 - math.exp(-trains / 500.0)))
    elif spec == "DEF":
        defn += gain
        att = max(5.0, att - penalty * 0.4 + 10.0 * (1.0 - math.exp(-trains / 500.0)))
    elif spec == "AGI":
        agi += gain
    elif spec == "HP":
        hp += gain * 3.0
    return Monster(f"Hist-{spec}-{trains}", hp, att, defn, agi, growth, trains, spec)

def build_proposed_monster(spec: str, trains: int, growth: float) -> Monster:
    hp, att, defn, agi = 120.0, 20.0, 18.0, 18.0
    # Growth rate multiplier: 5.45 -> 0.90, 6.25 -> 1.00, 7.06 -> 1.10 (~12-18% overall edge)
    g_mult = 0.90 + (growth - 5.45) / (7.06 - 5.45) * 0.20
    # Diminishing returns: meaningful at 100, strong at 1000, soft-capped by 3000
    main_gain = (24.0 * math.log1p(trains / 25.0) / math.log1p(3000 / 25.0) + 46.0 * (1.0 - math.exp(-trains / 450.0))) * g_mult
    sub_gain = main_gain * 0.30
    tradeoff = main_gain * 0.06

    if spec == "ATT":
        att += main_gain * 0.95
        hp += sub_gain * 1.5
        defn = max(5.0, defn + sub_gain * 0.35 - tradeoff)
        agi += sub_gain * 0.5
    elif spec == "DEF":
        defn += main_gain * 1.05
        hp += sub_gain * 2.2
        att += sub_gain * 0.72
        agi = max(5.0, agi - tradeoff * 0.4)
    elif spec == "AGI":
        agi += main_gain * 1.05
        att += sub_gain * 0.85
        hp += sub_gain * 1.5
        defn = max(5.0, defn - tradeoff * 0.4)
    elif spec == "HP":
        hp += main_gain * 2.65
        att += sub_gain * 0.65
        defn += sub_gain * 0.72
        agi += sub_gain * 0.65

    return Monster(f"V2-{spec}-{trains}", round(hp, 1), round(att, 1), round(defn, 1), round(agi, 1), growth, trains, spec)

def sim_battle(a: Monster, b: Monster, mode: str = "proposed"):
    hp_a, hp_b = a.hp, b.hp
    if mode == "historical":
        cd_a = max(0.5, 2.0 - a.agi * 0.01)
        cd_b = max(0.5, 2.0 - b.agi * 0.01)
    else:
        cd_a = max(0.45, 1.9 / (1.0 + a.agi / 45.0))
        cd_b = max(0.45, 1.9 / (1.0 + b.agi / 45.0))

    t_a, t_b = cd_a, cd_b
    elapsed = 0.0
    max_time = 90.0

    while hp_a > 0 and hp_b > 0 and elapsed < max_time:
        if t_a <= t_b:
            elapsed = t_a
            t_a += cd_a
            atk, dfn = a, b
            target_is_b = True
        else:
            elapsed = t_b
            t_b += cd_b
            atk, dfn = b, a
            target_is_b = False

        if mode == "historical":
            dmg = max(1.0, round(atk.att * 1.0 - dfn.defn * 0.8))
            thorns = 0.0
        else:
            dodge_chance = min(0.30, max(0.03, (dfn.agi - atk.agi) * 0.003 + 0.05))
            if random.random() < dodge_chance:
                dmg = 0.0
                thorns = 0.0
            else:
                mitigation = 110.0 / (110.0 + dfn.defn * 1.75)
                base_dmg = atk.att * 0.85 * mitigation
                crit_chance = min(0.32, 0.05 + atk.agi * 0.0022)
                mult = 1.45 if random.random() < crit_chance else random.uniform(0.92, 1.08)
                dmg = max(1.0, round(base_dmg * mult))
                thorns = round(dfn.defn * 0.12)

        if target_is_b:
            hp_b -= dmg
            hp_a -= thorns
        else:
            hp_a -= dmg
            hp_b -= thorns

    if hp_a > hp_b:
        return 1, elapsed, max(0.0, hp_a)
    elif hp_b > hp_a:
        return -1, elapsed, max(0.0, hp_b)
    return 0, elapsed, 0.0

def run_suite():
    print("=== 1. TRAINING PROGRESSION VS BASELINE (100-TRAIN BENCHMARK, 200 BATTLES EACH) ===")
    train_tiers = [0, 3, 100, 1000, 3000]
    bench = build_proposed_monster("HP", 100, 6.25)
    for t in train_tiers:
        wins, total_t = 0, 0.0
        n = 200
        m = build_proposed_monster("ATT", t, 6.25)
        for _ in range(n):
            res, el, _ = sim_battle(m, bench, "proposed")
            if res == 1:
                wins += 1
            total_t += el
        print(f"V2 ATT-{t:4d} (HP={m.hp:5.1f}, ATT={m.att:5.1f}, DEF={m.defn:4.1f}, AGI={m.agi:4.1f}) vs HP-100: WinRate={wins/n*100:5.1f}%, AvgTime={total_t/n:4.1f}s")

    print("\n=== 2. SPECIALIZATION TRIANGLE AT 1,000 TRAINS (200 BATTLES EACH) ===")
    specs = ["ATT", "DEF", "AGI", "HP"]
    for s1 in specs:
        row = []
        m1 = build_proposed_monster(s1, 1000, 6.25)
        for s2 in specs:
            if s1 == s2:
                row.append("  --  ")
                continue
            m2 = build_proposed_monster(s2, 1000, 6.25)
            w = sum(1 for _ in range(200) if sim_battle(m1, m2, "proposed")[0] == 1)
            row.append(f"{w/200*100:5.1f}%")
        print(f"{s1:3s} vs [ATT, DEF, AGI, HP]: " + " | ".join(row))

    print("\n=== 3. GROWTH RATE ADVANTAGE (5.45 vs 6.25 vs 7.06 AT 1,000 TRAINS, 250 BATTLES) ===")
    m_low = build_proposed_monster("ATT", 1000, 5.45)
    m_mid = build_proposed_monster("ATT", 1000, 6.25)
    m_high = build_proposed_monster("ATT", 1000, 7.06)
    w_hm = sum(1 for _ in range(250) if sim_battle(m_high, m_mid, "proposed")[0] == 1)
    w_hl = sum(1 for _ in range(250) if sim_battle(m_high, m_low, "proposed")[0] == 1)
    print(f"High(7.06) vs Mid(6.25): {w_hm/250*100:.1f}% win rate")
    print(f"High(7.06) vs Low(5.45): {w_hl/250*100:.1f}% win rate")

    print("\n=== 4. HISTORICAL LINEAR FORMULA CHECK (ATT-1000 vs DEF-1000, 200 BATTLES) ===")
    h_att = build_historical_monster("ATT", 1000, 6.25)
    h_def = build_historical_monster("DEF", 1000, 6.25)
    h_agi = build_historical_monster("AGI", 1000, 6.25)
    w_ad = sum(1 for _ in range(200) if sim_battle(h_att, h_def, "historical")[0] == 1)
    w_ga = sum(1 for _ in range(200) if sim_battle(h_agi, h_att, "historical")[0] == 1)
    print(f"Hist ATT-1000 vs DEF-1000 WinRate: {w_ad/200*100:.1f}%")
    print(f"Hist AGI-1000 vs ATT-1000 WinRate: {w_ga/200*100:.1f}%")

if __name__ == "__main__":
    run_suite()
