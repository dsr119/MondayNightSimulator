# Monday Night Simulator

Carbondale Commercial League, 2026–2027. Standalone JavaScript app for GitHub Pages and the user's Monday Supabase project.

## Status

Implementation review build. No production deployment or live database save has been verified.
The repository began empty. This app reuses the Scratch League visual foundation and modeling approach, with a separate Monday scoring engine and data schema.

Built:
- Five-player, three-game, 30-point scoring, handicap, blind and bye handling.
- Complete-week CSV preview/import, partial blind games, floating substitutes, officer-confirmed corrections.
- Full-season / half standings and half-specific projections.
- Seeded worker simulations, dynamic future handicaps, position-round opponents, fixed eight-team playoff bracket.
- Actual-only individual statistics; handicap-series All-Play.
- Team weekly odds and retained forecast history (up to 40 runs).
- Skill adjustments, recorded half winners, lineup/division editing.
- Local backups, validated restore, debug reports, Supabase login and optimistic concurrency with full read-back verification.

## Data still required

The reattached roster was visually transcribed on September 14: 20 teams, 96 named bowlers and four vacancies. New workspaces load it automatically; empty saved workspaces can load it from Setup. Names, listed order and team numbers are preserved. Missing entering averages are supplemented from matched names in the September 16 bowler list; unmatched averages remain null, and divisions remain unassigned. The attached 2025-2026 Player History.zip could not be extracted with the tools available in this session and has not been imported.
The supplied rule sheet says the official schedule will follow team/division finalization; no official schedule was found.
Enter confirmed entering averages in Teams and import the schedule in Setup. Forecasts stay blocked for missing averages and unfilled vacancies. Prior-season records are not current rosters.
The rules leave details unresolved; Setup explicitly gates forecasts until assumptions are reviewed. See config/league-rules.json.

## Run locally

Node 22+ for tests; Python 3 for the development server:

```sh
npm test
python3 -m http.server 8000
```

Open http://localhost:8000/dist/. No npm dependencies or build step.

## Set up Supabase

1. Run supabase/001_monday_workspace.sql in https://qfzoyultwhzsensbfegf.supabase.co via its Supabase SQL editor.
2. Create the administrator account in Authentication > Users.
3. Run the administrator insert shown at the end of the migration, replacing YOUR_EMAIL.
4. Sign in through Setup, then Load saved league. An empty database establishes revision 0 without replacing local inputs.
5. Import data and Save league. The app verifies the saved revision and full workspace against a new read.

The browser contains only the provided publishable key. Dedicated monday_* tables have RLS; only administrators can save, through the version-checked RPC. No service role key is used. The migration does not replace any existing Scratch tables.

## CSV inputs

Download templates from Setup. CSV IDs are stable bowler identities, not names.

- Roster: team,team_name,division,slot,bowler_id,bowler,entering. Regular teams have five starters. Team 0 / slot 0 are substitutes.
- Schedule: week,kind,team_a,team_b,lane. Bye = team_b 0. Position rows use kind=position. Blank position pair fields are accepted. Official pairings can instead be supplied as regular rows for an already determined position night.
- Scores: week,team,opponent,slot,bowler_id,game1,game2,game3,type1,type2,type3,average,handicap. One complete week. Actual scores 0–300. Types actual/blind/vacancy. Supply official average/handicap snapshots when available. Blank fields calculate using current settings and earlier actual games.
- History: bowler_id,date,game1,game2,game3. YYYY-MM-DD; historical sessions affect projections only.

Entering averages are supplied by the administrator after applying Rule 6; the program does not guess missing averages or infer sex from names. Roster replacement is locked once results exist. Use Teams to add substitutes or change future lineup/division assignments. Score corrections require explicit officer confirmation. Existing later-week official average/handicap snapshots are preserved after corrections.

## Model assumptions and limits

- Five saved starters bowl in saved order, with no projected absences. Future lineup strategies are not modeled.
- A bowler's simulated average updates after nine games; weekly handicap uses the floor of cumulative average. Handicap rounding is configurable.
- Model mean blends prior history / entering average and actual current scores, with a 30-game prior weight. Variance is regularized toward 30 pins; shared lane/night variation is included.
- Two halves of 16 weeks; position rounds in Weeks 10,13,16,26,29,32.
- Before official divisions arrive in Week 3, wholly unassigned rosters use a fresh seeded, balanced division draw per simulated season (20 teams: three divisions of 7, 7, and 6). That draw stays fixed for both halves and governs position rounds and qualification. No random assignments are saved to the roster. Projections are labeled provisional. Enter all official divisions in Teams & bowlers and rerun; partial assignments block forecasts. Other missing inputs still block forecasts.
- Division half winners qualify; remaining slots are filled by the highest full-season points among teams not already qualified, as confirmed by the user. Division winners seed ahead of wildcards.
- Tied half qualification uses one-game point roll-offs. Multi-team ties use a randomized-order knockout assumption. Seeding ties use that same provisional tie resolver.
- Position-round ties use scratch team average then team number. Odd division groups receive a bye under the selected provisional grouping.
- Vacancy positions currently behave as non-actual blind positions for individual points. Confirm local interpretation before importing vacancy matchups.
- A tied playoff match proceeds to a nine-point roll-off. Repeated ties are resolved by another roll-off; on a one-game points tie the model uses handicap team pins (Rule 9 behavior). This extension to playoff ties is provisional.
- Playoff handicap averages remain based on regular-season actual/simulated games, not projected earlier playoff rounds.
- Eligibility warnings cover minimum actual lineup counts and position-round game requirements. Certification and former-team playoff eligibility require officer review; the program is not an eligibility authority.
- All-Play compares handicap three-game series, not hypothetical 30-point lineup matchups.
- No backtesting or calibrated predictive-accuracy claim. No synthetic scores are stored as actual data.
- Browser visual/accessibility inspection and live Supabase verification remain to be completed.

## Review / deployment

The app belongs on a review branch. Main initially contains only the repository initialization README.
The included Pages workflow runs on main only, after tests pass. Enable GitHub Pages with source GitHub Actions after merging.
The checks workflow runs on pushes and pull requests and uploads a preview artifact containing dist/.

## September 16 bowler list update

The supplied Bowler List (8).xlsx contains 94 rows, 93 positive EnteringAvg values, and no Team 20 rows. The app fills missing entering averages for 74 confidently matched names in the original roster on startup, cloud load, and backup restore. Existing averages, IDs, lineups, history, and actual results remain unchanged. Matching is by name and team, never by lineup position. Explicit spelling aliases are in dist/bowler-averages.js. The original Team 6 Robert/Bob Johnson identities remain unresolved against the source Bob/Bobby Johnson rows. Tyler Eisenhaur has EnteringAvg=0 and is treated as missing, not as a zero-average bowler. Source pins, games, and high scores are not fabricated into game sessions. Save league after loading to persist filled averages.
