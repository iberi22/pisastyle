---
id: science-en-2026-10-04-unidad-01
title: Science Unit 01 — Energy, Matter, Populations and Earth Systems
domain: science
lang: en
protocol_version: v1.1
items: 8
---

Eight standalone items calibrated against released OECD PISA units. Every figure was
checked by computation: powers and times, distances and speeds, unit conversions,
compound growth, trophic transfer, clock arithmetic and rates. Content mix follows
section 2 of the protocol: 3 physical, 3 living, 2 earth-and-space; competencies
3 explain (C1), 3 interpret (C2), 2 investigate (C3). Contexts follow the
personal / societal / global 2:4:2 split. Difficulty and level rise monotonically
and the last item is the highest-level one, per section 3.

The OECD units cited in each Calibration block were released for practice. They are
cited here as calibration references only; the items below are original text.

---

## Item 1

A family uses a 1,500 W electric heater for 12 minutes to warm one room. The
electric energy that the heater delivers during that time is:

- [x] A) 1,080,000 J
- [ ] B) 18,000 J
- [ ] C) 10,800,000 J
- [ ] D) 2,160,000 J

### Explicacion Pedagogica

Energy is power multiplied by time, so the time must be converted to seconds:
1,500 W x 720 s = 1,080,000 J, which confirms A. B keeps 12 as if it were already
seconds, so it treats the duration as a hundredth of the real one. C adds a factor of
ten that the data never justify. D doubles the power to 3,000 W, which would be the
case of two heaters running, not one.

### Calibration
- domain: science
- process: explain (C1)
- content: physical
- context: local
- format: mc-single
- demand: med
- difficulty_band: D3-D4
- level: 2
- anchor: MA104-CarPurchase
- sources:
  - https://pisa2022-questions.oecd.org/

---

## Item 2

A delivery van drives at a constant 50 km/h for 1 hour and then at a constant
70 km/h for 3 hours. What is the average speed of the van for the whole trip?

- [ ] A) 60 km/h
- [x] B) 65 km/h
- [ ] C) 70 km/h
- [ ] D) 87 km/h

### Explicacion Pedagogica

Average speed is total distance divided by total time, so the two distances must be
added first: 50 km plus 210 km is 260 km over 4 hours, giving 65 km/h, which
confirms B. A is the plain mean of the two speeds and ignores that more time was
spent at 70 km/h. C assumes the van never slowed down. D divides by 3 hours only,
counting one of the two legs and inflating the result.

### Calibration
- domain: science
- process: interpret (C2)
- content: physical
- context: societal
- format: mc-single
- demand: low
- difficulty_band: D3-D4
- level: 2
- anchor: MA104-CarPurchase
- sources:
  - https://pisa2022-questions.oecd.org/

---

## Item 3

A steel block measures 20 cm by 10 cm by 1 cm and has a mass of 1.6 kg. What is
the density of the block, expressed in kg/m3?

- [ ] A) 8 kg/m3
- [ ] B) 800 kg/m3
- [x] C) 8,000 kg/m3
- [ ] D) 80 kg/m3

### Explicacion Pedagogica

The volume is 20 x 10 x 1 = 200 cm3, and 200 cm3 equals 0.0002 m3, so 1.6 kg
divided by 0.0002 m3 gives 8,000 kg/m3, confirming C. A treats 200 cm3 as if it were
0.2 m3, a slip of three orders of magnitude. B divides by 0.002 instead of 0.0002.
D divides the mass by the 200 cm2 face area, which is a surface and not a volume.

### Calibration
- domain: science
- process: explain (C1)
- content: physical
- context: local
- format: mc-single
- demand: med
- difficulty_band: D5-D6
- level: 3
- anchor: MA161-ForestedAreas
- sources:
  - https://pisa2022-questions.oecd.org/

---

## Item 4

In early spring a beekeeper counts 3,200 bees in a hive. The population then grows
by 15% every month for two months. How many bees are in the hive after those two
months?

- [ ] A) 3,680
- [ ] B) 4,160
- [ ] C) 3,872
- [x] D) 4,232

### Explicacion Pedagogica

Growth compounds because each month the increase is taken on the new, larger
population: month 1 gives 3,680 bees and month 2 gives 4,232, confirming D. A stops
after the first month. B adds the first increase of 480 bees a second time instead
of recalculating 15% of 3,680. C repeats the calculation correctly but with a 10%
rate, which is not the rate given.

### Calibration
- domain: science
- process: interpret (C2)
- content: living
- context: global
- format: mc-single
- demand: med
- difficulty_band: D5-D6
- level: 3
- anchor: T400-SaveTheBees
- sources:
  - https://pisa2022-questions.oecd.org/

---

## Item 5

An energy pyramid for a grassland ecosystem shows 4,000 kJ stored in the producers.
Consumers at each higher level receive about 10% of the energy of the level below.
How much energy is stored in the secondary consumers?

- [x] A) 40 kJ
- [ ] B) 400 kJ
- [ ] C) 4 kJ
- [ ] D) 160 kJ

### Explicacion Pedagogica

The primary consumers receive 10% of 4,000 kJ, which is 400 kJ, and the secondary
consumers receive 10% of that, so 40 kJ, confirming A. B stops at the primary
consumers. C applies the rule twice more and lands on the tertiary consumers. D
assumes a 20% transfer efficiency, a rule the stimulus explicitly does not give.

### Calibration
- domain: science
- process: explain (C1)
- content: living
- context: global
- format: mc-single
- demand: med
- difficulty_band: D5-D6
- level: 4
- anchor: T400-SaveTheBees
- sources:
  - https://pisa2022-questions.oecd.org/

---

## Item 6

A student buries 30 g of dry autumn leaves in a compost heap and weighs the dry
residue every month. The measurements are: 3 g after month 1, 9 g after month 2,
11 g after month 3 and 12 g after month 4. Which statement is best supported by
these data?

- [ ] A) The heap gained mass because the decomposers added matter to it
- [x] B) The mass of residue lost in each successive month became smaller
- [ ] C) Decomposition was fastest during the fourth month
- [ ] D) The residue halved at a constant rate every month

### Explicacion Pedagogica

The mass lost was 27 g in month 1, then 21 g, 19 g and 18 g, a decreasing series, so
B is the statement the data support. A contradicts the measurements, which fall from
30 g to 12 g. C reverses the trend: the smallest loss, 18 g, happened last. D
expects a halving every month, so it would require 15 g after month 1 where the
measurement is 3 g, and equal monthly losses, which never occur.

### Calibration
- domain: science
- process: investigate (C3)
- content: living
- context: local
- format: mc-single
- demand: high
- difficulty_band: D7-D8
- level: 4
- anchor: T400-SaveTheBees
- sources:
  - https://pisa2022-questions.oecd.org/

---

## Item 7

Sunlight travels from the Sun to Earth across a distance of 150,000,000 km at a
speed of 300,000 km/s. How long does that light take to reach Earth?

- [ ] A) 50 seconds
- [ ] B) 1,500 seconds
- [x] C) 500 seconds
- [ ] D) 5,000 seconds

### Explicacion Pedagogica

Dividing the distance by the speed gives 150,000,000 km / 300,000 km/s = 500
seconds, confirming C, and the units of km cancel, so no conversion is needed. A
comes from dropping three zeros from the distance and misplacing the decimal.
B comes from shifting the digits of the speed. D transposes the three zeros of the
distance and so multiplies the true time by ten.

### Calibration
- domain: science
- process: interpret (C2)
- content: earth-and-space
- context: global
- format: mc-single
- demand: high
- difficulty_band: D7-D8
- level: 5
- anchor: MA123-SolarSystem
- sources:
  - https://pisa2022-questions.oecd.org/
  - https://science.nasa.gov/

---

## Item 8

In a town near the equator the Sun rises at 07:12 and sets at 17:48 on 21 June. On
21 December in the same town it rises at 08:04 and sets at 16:32. How much longer
is the day in June than in December?

- [ ] A) 1 hour 4 minutes
- [ ] B) 2 hours 36 minutes
- [ ] C) 4 hours 16 minutes
- [x] D) 2 hours 8 minutes

### Explicacion Pedagogica

The June day lasts 10 hours 36 minutes and the December day lasts 8 hours 28
minutes, so the difference is 2 hours 8 minutes, confirming D. A halves that
difference, which corresponds to comparing the equinox day length. B rounds the
December day up to 8 hours and inflates the gap by 28 minutes. C doubles the
difference, as if each sunrise and sunset had to be counted twice.

### Calibration
- domain: science
- process: interpret (C2)
- content: earth-and-space
- context: societal
- format: mc-single
- demand: high
- difficulty_band: D7-D8
- level: 5
- anchor: MA123-SolarSystem
- sources:
  - https://pisa2022-questions.oecd.org/
  - https://science.nasa.gov/