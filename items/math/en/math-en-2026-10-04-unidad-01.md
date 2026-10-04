---
id: math-en-2026-10-04-unidad-01
domain: math
lang: en
protocol_version: v1.1
items: 8
---

# PISAStyle Mathematics Unit 01 (English)

Eight PISA-style mathematics items authored for PISAStyle and calibrated against
released OECD PISA 2022 practice units. The items in this file are original
PISAStyle content; the `anchor` of each item names the official OECD unit that
fixes its difficulty band and thematic domain. The official units are published
by the OECD for practice and are not released under a Creative Commons licence,
so they are cited here as calibration references and are not reproduced.

## Item 1

A used car is listed at 20,000 euros. The dealer offers a 15% discount on the
listed price. What is the final price the buyer pays?

- [x] A) 17,000 euros
- [ ] B) 23,000 euros
- [ ] C) 3,000 euros
- [ ] D) 20,000 euros

### Explicacion Pedagogica

The correct answer is A. The discount is 15% of 20,000, that is 3,000 euros,
and the final price is 20,000 - 3,000 = 17,000 euros. Option B ignores the
discount entirely and simply repeats the listed price. Option C adds 15% instead
of subtracting it, which is the classic direction error on a percentage change.
Option D reports the size of the discount instead of the price paid, so it
confuses the part with the whole.

### Calibration
- domain: math
- process: employ
- content: quantity
- context: personal
- format: mc-single
- demand: low
- level: 2
- anchor: MA104-CarPurchase
- difficulty_band: D2-D3
- sources:
  - https://pisa2022-questions.oecd.org/

## Item 2

A video shop sold 240 DVDs in Week 1 and 300 DVDs in Week 2. What is the
percentage increase from Week 1 to Week 2?

- [ ] A) 11.1%
- [x] B) 25%
- [ ] C) 60%
- [ ] D) 20%

### Explicacion Pedagogica

The correct answer is B. The increase is 300 - 240 = 60 DVDs, and a percentage
increase is measured against the starting value, so 60 / 240 = 0.25 = 25%.
Option A is the mirror error: 60 / 300 = 20% measures the increase against the
final value instead. Option C divides the increase by the combined total of 540
DVDs, which is not how a rate of change is defined. Option D gives the absolute
increase of 60 DVDs, a correct quantity expressed in the wrong unit.

### Calibration
- domain: math
- process: interpret
- content: quantity
- context: occupational
- format: mc-single
- demand: med
- level: 3
- anchor: MA106-DVDSales
- difficulty_band: D3-D4
- sources:
  - https://pisa2022-questions.oecd.org/

## Item 3

A removal truck has a cargo volume of 48 cubic metres. Each box takes up
0.6 cubic metres. What is the greatest number of boxes the truck can carry?

- [ ] A) 8 boxes
- [ ] B) 96 boxes
- [x] C) 80 boxes
- [ ] D) 28.8 boxes

### Explicacion Pedagogica

The correct answer is C. The number of boxes is the available volume divided by
the volume of one box: 48 / 0.6 = 80 boxes, which is a whole number so nothing
is left over. Option A multiplies 48 by 0.6 instead of dividing, which shrinks
the answer instead of counting how many boxes fit. Option B divides by 0.5, a
plausible slip in the volume of a box that doubles the result. Option D shifts the decimal
point one place to the left, the standard error when dividing by a decimal.

### Calibration
- domain: math
- process: formulate
- content: space
- context: occupational
- format: mc-single
- demand: med
- level: 3
- anchor: MA118-MovingTruck
- difficulty_band: D3-D4
- sources:
  - https://pisa2022-questions.oecd.org/

## Item 4

A rooftop solar array covers 18 square metres. Each square metre produces 3
kilowatt hours per day. The household needs 90 kilowatt hours per day. What
percentage of the daily need is covered by the array?

- [ ] A) 40%
- [ ] B) 5%
- [ ] C) 20%
- [x] D) 60%

### Explicacion Pedagogica

The correct answer is D. The array produces 18 x 3 = 54 kilowatt hours per day,
and 54 / 90 = 0.60, so 60% of the need is covered. Option A compares the panel
area to the consumption number, mixing two incommensurable quantities. Option B
is the share that still has to come from the grid, 36 / 90, which is the
complement of the correct answer. Option C inverts the ratio 90 / 18 and then
drops the production factor, giving a number that is not a percentage at all.
This item is scored as one dichotomous response, but partial credit applies to
the reasoning chain: the production step alone earns half of the marks.

### Calibration
- domain: math
- process: reason
- content: quantity
- context: scientific
- format: mc-complex
- demand: high
- level: 4
- anchor: MA123-SolarSystem
- difficulty_band: D4-D5
- sources:
  - https://pisa2022-questions.oecd.org/

## Item 5

A spinner is divided into 5 equal sectors, 2 of which are shaded. The spinner
is spun twice. What is the probability that both spins land on a shaded
sector?

- [ ] A) 4/5
- [ ] B) 3/5
- [x] C) 4/25
- [ ] D) 2/5

### Explicacion Pedagogica

The correct answer is A. One spin lands on a shaded sector with probability
2/5, and because the spins are independent the probability of two shaded
sectors is (2/5) x (2/5) = 4/25. Option B gives the probability for a single
spin and ignores the repetition. Option C gives the probability of landing on an
unshaded sector, 3/5, which is the complement of a single spin. Option D adds the
two probabilities of a single spin, 2/5 + 2/5, which is the standard error of
treating independent events as mutually exclusive.

### Calibration
- domain: math
- process: reason
- content: uncertainty
- context: scientific
- format: mc-single
- demand: high
- level: 4
- anchor: MA159-Spinners
- difficulty_band: D4-D5
- sources:
  - https://pisa2022-questions.oecd.org/

## Item 6

A row of connected triangles is built from matchsticks. The first figure uses 3
matchsticks, the second uses 5, the third uses 7, and each new figure adds 2
matchsticks. How many matchsticks are needed for the figure with 24 triangles?

- [ ] A) 24
- [ ] B) 72
- [ ] C) 47
- [x] D) 49

### Explicacion Pedagogica

The correct answer is B. The sequence 3, 5, 7, 9, ... increases by 2 each time,
so its rule is 2n + 1, and for n = 24 that gives 2 x 24 + 1 = 49 matchsticks.
Option A applies the wrong constant term, 2n - 1, which produces a sequence
1, 3, 5, ... that does not match the first figure. Option C uses 3n, the rule for
a row of squares, which fits the wrong shape. Option D simply repeats the number
of triangles, ignoring the matchsticks that link them. Partial credit is
available for the correct rule 2n + 1 even without the final substitution.

### Calibration
- domain: math
- process: formulate
- content: space
- context: scientific
- format: mc-complex
- demand: high
- level: 5
- anchor: MA150-TriangularPattern
- difficulty_band: D5-D6
- sources:
  - https://pisa2022-questions.oecd.org/

## Item 7

Four countries protect the following shares of their land as forest: 12%, 25%,
30% and 33%. What is the mean share of protected forest land across the four
countries?

- [x] A) 25%
- [ ] B) 27.5%
- [ ] C) 33%
- [ ] D) 20%

### Explicacion Pedagogica

The correct answer is C. The shares add up to 12 + 25 + 30 + 33 = 100, and the
mean divides that total by the four countries, giving 100 / 4 = 25%. Option A
divides the total by 5, using one country too many. Option B reports the median,
the average of the middle two shares 25% and 30%, which is a different measure
of centre. Option D reports the largest share instead of an average. This item is
scored dichotomously, but partial credit applies: adding the four shares
correctly earns half of the marks.

### Calibration
- domain: math
- process: interpret
- content: uncertainty
- context: societal
- format: mc-complex
- demand: med
- level: 4
- anchor: MA161-ForestedAreas
- difficulty_band: D4-D5
- sources:
  - https://pisa2022-questions.oecd.org/

## Item 8

A car costs 24,000 euros. The buyer pays a deposit of 4,800 euros and then 48
monthly instalments of 460 euros. By what percentage does the total amount paid
exceed the listed price?

- [ ] A) 92%
- [x] B) 12%
- [ ] C) 112%
- [ ] D) 20%

### Explicacion Pedagogica

The correct answer is D. The instalments total 48 x 460 = 22,080 euros, so the
total paid is 4,800 + 22,080 = 26,880 euros, which exceeds the listed price by
2,880 euros. As a percentage of the listed price that is 2,880 / 24,000 = 12%.
Option A is the deposit alone, 4,800 / 24,000, and ignores the financing cost.
Option B is the financed share of the listed price, 22,080 / 24,000. Option C is
the total as a percentage of the listed price, 112%, which measures the whole
amount instead of the excess. Partial credit applies to each verified step.

### Calibration
- domain: math
- process: reason
- content: quantity
- context: personal
- format: mc-complex
- demand: high
- level: 5
- anchor: MA104-CarPurchase
- difficulty_band: D5-D6
- sources:
  - https://pisa2022-questions.oecd.org/
