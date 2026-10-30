# Local X01 metric and evidence contract

Definition identifier: `x01-recorded-v1`. Implemented in `src/domain/metrics.ts`; match, side, participant and profile statistics use the same calculation. This identifier versions metric meaning independently of saved-match schema versions. Exports include the identifier in their derived result, and the UI displays it in “Score data and definitions”. Derived export results are never trusted on import: commands are replayed again.

## Sample and formula

- Credited points are the visit total, except a bust credits zero. Unopened double-in darts credit no points; entered segment visits are evaluated under the match opening and finishing rules.
- Darts are the recorded visit dart count, including busts, misses and unopened darts. Total-only entry is the scorer’s reported count, not a measured count. No missing segments, intended targets or extra darts are reconstructed.
- Three-dart average is `3 × sum(credited points) / sum(recorded darts)`, rounded once to one decimal. Zero recorded darts displays an em dash. Profile averages aggregate points and darts, never the mean of match averages.
- Best visit and 100–139 / 140–179 / 180 visit counts exclude busts. Highest checkout is the largest credited visit marked as a legal checkout by replay. A checkout total is not a checkout-attempt percentage.
- Side statistics include all visits for the side. Participant statistics include only the stable participant ID; profile statistics include only visits carrying that explicit profile link. Side wins/played legs are shared outcomes, not another member’s personal darts or finishes.
- Profile scope is retained, decided, explicitly linked matches, with practice separated and a selected singles/multiplayer/team/all-format filter. Abandoned and unfinished matches are excluded. Concessions count as outcomes without fabricated legs. The archive currently retains at most 100 matches, so these are retained-history records rather than lifetime records.
- Duplicate match IDs count once in profile aggregation. Sample counts reflect the same accepted records as the score statistics. Imported-match count uses the saved import marker and is not a forensic guarantee. Rule-configuration count distinguishes start, opening/finishing rule and leg/set win targets; mixed samples are disclosed. Practice summaries also count distinct opponent/model/custom configurations and disclose combined samples; no bot strength/rating is inferred from the aggregate.

## Input labels and coverage

New visits recorded by this app in schema v5 carry an optional backward-compatible `source` field: `manual-segments`, `manual-total` or `simulated`. The current app supplies the label at the scoring boundary, together with the actual thrower ID. Replay validates the enum, human/bot role and consistency with segment presence. Unknown source values and contradictory claims fail before persistence/import.

Earlier v5 records may lack the field; versions 1–4 cannot adopt it without moving to a newer schema. Their stored commands are preserved. Continuing an older session keeps its existing schema, so newly appended human visits there also remain source-unknown; starting a new game/rematch creates v5 and records entry labels. This avoids retroactively asserting an origin or rewriting old command identities. Human visits without a source label show **Origin not recorded**, even if segment details are present. Bot visits are **Simulated**, derived from the actual practice-side role, including legacy practice matches. Human practice visits are separate from bot visits.

Replay derives `origin`; it is not trusted from an imported file. Normalisation preserves supported `source` labels and discards unsupported derived fields. Backup/export/import preserves labels and actual segments; import markers do not change the score arithmetic or upgrade trust. Input labels in a local file can be edited and are claims about entry, not authentication.

Coverage reports visits, recorded darts, visits/darts with individual segments, visits/darts with totals only, and counts by origin. “Complete segment history” requires a non-empty sample and segment details for every recorded dart. Empty history is not complete. Coverage measures data availability, not the truth of a claimed throw or accuracy of a camera.

## Capabilities and unavailable metrics

The domain returns explicit flags, consumed alongside coverage:

| Capability                  | Current gate                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Score metrics               | At least one recorded visit                                                          |
| Complete segment history    | Non-empty sample with segments for every visit                                       |
| Checkout attempt rate       | Unavailable; intended targets/attempts are not recorded under an accepted definition |
| Target accuracy             | Unavailable; a hit segment alone does not describe the intended target               |
| Impact coordinates          | Unavailable; no measured board coordinates exist in this input contract              |
| Verified competitive record | False for every current local/imported/practice record                               |

The UI uses “Unavailable” with a reason for unsupported metrics, not zero or invented percentages. There is no ranking-eligible record path in this local application. Removing an import flag, filling every dart segment or claiming a source cannot enable verification. A future server-owned competition/referee and provider event contract must establish its own authority, revision, attribution, correction, provenance and eligibility policies before enabling trusted results. Hardware/adapter compatibility is not implied by this contract.

## Version policy

Changing scope, denominator, bust/opening treatment, attribution or eligibility needs an explicit definition change, fixtures and migration/recalculation notes. Adding an input source requires schema validation and replay/import tests before UI exposure. New schemas must preserve the old source and metric interpretation rather than retroactively asserting measurements that were never captured. No persisted derived aggregate is authoritative.
