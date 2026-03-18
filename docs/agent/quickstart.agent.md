# Quickstart Agent Notes

## Setup Loop

1. tokenize the text
2. create a timeline
3. construct `OraPlaybackTracker`
4. feed boundary or provider marks when available
5. fall back to `updateFromClock`

## Best Use

Drive highlighting and active segment state in host UIs.
