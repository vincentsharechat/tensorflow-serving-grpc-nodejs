# Feature Examples Guide

This document describes how to use the pre-defined feature examples for testing the DNB model via gRPC ingress.

## Quick Start

Run the client with the first example:

```bash
npm run client:ingress
```

Score all feature examples at once:

```bash
npm run client:ingress:all
```

## Using Different Examples

Specify an example index (0-based) to use a different example:

```bash
# Use example 0 (high-value user with winning bid)
node client-ingress.js 0

# Use example 5 (older user demographic)
node client-ingress.js 5

# Use example 9 (Moj CPCV, Hindi user)
node client-ingress.js 9

# Score all 10 examples and display summary
npm run client:ingress:all
```

## Available Examples

| Index | Description | Key Characteristics |
|-------|-------------|-------------------|
| 0 | High-value user with winning bid | SC_CPCV_2, winning_bid=21.29, high engagement |
| 1 | Moj app, no response | Moj-Exit-Interstitial, winning_bid=0, winrate~0.09 |
| 2 | Tamil language, female user | SC_OUTSTREAM_NON_INFEED, female, low engagement |
| 3 | Low floor price, Gujarat user | SC_OUTSTREAM, floor_price=5, low engagement |
| 4 | High historical winrate, high floor | Moj-Share-Screen, winrate_1_day=0.9286, floor_price=28 |
| 5 | Older user demographic (45-100) | SC_OUTSTREAM_NON_INFEED, age=45-100, female |
| 6 | High engagement (feed_fetch=3), Malayalam | SC_OUTSTREAM, feed_fetch=3, high engagement |
| 7 | High floor price (₹41), female user | SC_CPCV_1, floor_price=41, female |
| 8 | Telugu user, moderate engagement | SC_OUTSTREAM, feed_fetch=4, moderate engagement |
| 9 | Moj CPCV, Hindi user | MOJ_CPCV_2, floor_price=26, Hindi |

## Adding New Examples

To add more feature examples, edit `feature-examples.js`:

```javascript
{
  // Example 11: Your description
  ad_type: ["AD_TYPE"],
  adsuuid: ["uuid"],
  ageRange: ["age-range"],
  city: ["city"],
  // ... more features
}
```

Then update the EXAMPLES.md table above with the new example.

## Programmatic Usage

Use the feature examples in your code:

```javascript
const { getExample, getAll, getCount } = require('./feature-examples');

// Get a specific example
const example = getExample(0);

// Get all examples
const allExamples = getAll();

// Get total count
const totalCount = getCount();
```

## Features Included in Examples

Each example contains the following features:

- `ad_type`: Advertisement type
- `adsuuid`: Advertisement UUID
- `ageRange`: User age range
- `city`: User city
- `feed_fetch_counter`: Feed fetch engagement metric
- `gender`: User gender
- `language`: User language preference
- `osVersion`: Device OS version
- `phoneCarrier`: Mobile carrier
- `phoneModel`: Phone model
- `sourceApp`: Source application (SC/MJ)
- `state`: User state
- `time`: Request timestamp
- `userid`: User identifier
- `floor_price`: Floor price (optional)
- `winning_bid`: Winning bid amount (optional)
- `winrate_1_day`: 1-day winning rate (optional)
- `winrate_7_day`: 7-day winning rate (optional)
