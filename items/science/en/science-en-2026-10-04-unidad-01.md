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
- anchor: MA161-ForestedAreas
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
- anchor: MA161-ForestedAreas
- sources:
  - https://pisa2022-questions.oecd.org/

---

## Item 6

A student buries 30 g of dry autumn leaves in a compost heap and weighs the dry
residue at the end of every month. The mass falls from 30 g to 19 g after the
first month, to 13 g after the second, to 10 g after the third and to 8 g after
the fourth. Which statement is best supported by these data?

- [ ] A) The heap gained mass because the decomposers added matter to it
- [x] B) The mass lost in each successive month became smaller
- [ ] C) Decomposition was fastest during the fourth month
- [ ] D) The residue halved at a constant rate every month

### Explicacion Pedagogica

Work out the mass lost each month by subtracting one measurement from the one
before it: 30 minus 19 is 11 g in the first month, 19 minus 13 is 6 g in the
second, 13 minus 10 is 3 g in the third and 10 minus 8 is 2 g in the fourth. That
is 11, 6, 3 and 2: a decreasing series, so B is what the data support. A is ruled
out because the heap never gains mass, it goes from 30 g down to 8 g and the four
losses add up to exactly the 22 g that disappear. C reverses the trend: the
smallest single loss, 2 g, is the one recorded in the fourth month. D would
require halving every month, which would leave 15 g after the first month where
the measurement is 19 g, and four equal losses where the losses are clearly
unequal.

### Calibration
- domain: science
- process: investigate (C3)
- content: living
- context: local
- format: mc-single
- demand: high
- difficulty_band: D7-D8
- level: 4
- anchor: MA161-ForestedAreas
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

In a city at about 41 degrees north, the Sun rises at 06:15 and sets at 20:45 on
21 June. On 21 December in the same city it rises at 08:05 and sets at 17:35. How
much longer is the day in June than in December?

- [ ] A) 2 hours 30 minutes
- [ ] B) 6 hours 15 minutes
- [ ] C) 10 hours 0 minutes
- [x] D) 5 hours 0 minutes

### Explicacion Pedagogica

The June day lasts from 06:15 to 20:45, which is 14 hours 30 minutes. The December
day lasts from 08:05 to 17:35, which is 9 hours 30 minutes. The difference is
14 h 30 min minus 9 h 30 min, that is 5 hours 0 minutes, so D is correct. A is
what you get by halving the difference instead of subtracting, a slip that comes
from treating the two day lengths as a single figure to split. B adds a quarter
to the correct gap, as if one of the two day lengths had been read at the wrong
hour. C doubles the difference, which happens when both the sunrise and the
sunset are counted in each day length.

The city matters: at 41 degrees north the tilt of the Earth's axis really does
make summers long and winters short. At the equator it would not, because there
the axis tilt changes only the angle of the sunlight and not the length of the
day, which stays close to 12 hours all year.

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
