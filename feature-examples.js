/**
 * Feature Examples for DNB Model Ingress Testing
 *
 * This file contains pre-defined feature examples for testing the DNB model
 * predictions via gRPC ingress. Each example represents different user segments
 * and engagement patterns.
 *
 * Usage:
 *   npm run client:ingress   # Uses the first example
 *   node client-ingress.js 0 # Specify example index (0-based)
 */

const featureExamples = [
  {
    // Example 1: High-value user with winning bid
    ad_type: ["SC_CPCV_2"],
    adsuuid: ["aa8e7f93-7f33-469f-81b0-fb2146e5ee4e"],
    ageRange: ["25-34"],
    city: ["mumbai"],
    feed_fetch_counter: ["2"],
    gender: ["M"],
    language: ["punjabi"],
    osVersion: ["rest"],
    phoneCarrier: ["airtel"],
    phoneModel: ["samsung sm-g960w"],
    sourceApp: ["SC"],
    state: ["maharashtra"],
    time: ["2025-10-20 15:34:24"],
    userid: ["2356401887"]
  },
  {
    // Example 2: Moj app, no response
    ad_type: ["Moj-Exit-Interstitial"],
    adsuuid: [""],
    ageRange: ["18-24"],
    city: ["thane"],
    feed_fetch_counter: [""],
    gender: ["M"],
    language: ["marathi"],
    osVersion: ["android 8.0.0 (26)"],
    phoneCarrier: ["vodafone in"],
    phoneModel: ["sm-j600g"],
    sourceApp: ["MJ"],
    state: ["maharashtra"],
    time: ["2025-10-20 11:50:14"],
    userid: ["59834594701"]
  },
  {
    // Example 3: Tamil language, female user
    ad_type: ["SC_OUTSTREAM_NON_INFEED"],
    adsuuid: [""],
    ageRange: ["25-34"],
    city: ["mysuru"],
    feed_fetch_counter: [""],
    gender: ["F"],
    language: ["tamil"],
    osVersion: ["android 13 (33)"],
    phoneCarrier: ["airtel"],
    phoneModel: ["v2240"],
    sourceApp: ["SC"],
    state: ["karnataka"],
    time: ["2025-10-20 07:58:59"],
    userid: ["1197256433"]
  },
  {
    // Example 4: Low floor price, Gujarat user
    ad_type: ["SC_OUTSTREAM"],
    adsuuid: ["593c192b-bde2-4af5-80b6-495480ee3407"],
    ageRange: ["25-34"],
    city: ["dahod"],
    feed_fetch_counter: ["1"],
    gender: ["M"],
    language: ["gujarati"],
    osVersion: ["rest"],
    phoneCarrier: ["jio 4g"],
    phoneModel: ["vivo vivo 1820"],
    sourceApp: ["SC"],
    state: ["gujarat"],
    time: ["2025-10-20 08:08:45"],
    userid: ["2089988753"]
  },
  {
    // Example 5: High historical winrate, high floor
    ad_type: ["Moj-Share-Screen-Interstitial"],
    adsuuid: [""],
    ageRange: ["18-24"],
    city: ["amritsar"],
    feed_fetch_counter: [""],
    gender: ["M"],
    language: ["hindi"],
    osVersion: ["android 15 (35)"],
    phoneCarrier: ["jio 4g"],
    phoneModel: ["sm-e055f"],
    sourceApp: ["MJ"],
    state: ["punjab"],
    time: ["2025-10-20 21:20:28"],
    userid: ["75424155751"]
  },
  {
    // Example 6: Older user demographic (45-100)
    ad_type: ["SC_OUTSTREAM_NON_INFEED"],
    adsuuid: [""],
    ageRange: ["45-100"],
    city: ["satna"],
    feed_fetch_counter: [""],
    gender: ["F"],
    language: ["hindi"],
    osVersion: ["android 10 (29)"],
    phoneCarrier: ["vi india | idea"],
    phoneModel: ["samsung sm-m305f"],
    sourceApp: ["SC"],
    state: ["madhya pradesh"],
    time: ["2025-10-20 08:35:03"],
    userid: ["986973372"]
  },
  {
    // Example 7: High engagement (feed_fetch=3), Malayalam
    ad_type: ["SC_OUTSTREAM"],
    adsuuid: ["7fd28b76-0a12-4359-8d83-9bb078bff122"],
    ageRange: ["rest"],
    city: ["thiruvananthapuram"],
    feed_fetch_counter: ["3"],
    gender: ["rest"],
    language: ["malayalam"],
    osVersion: ["rest"],
    phoneCarrier: ["jio 4g"],
    phoneModel: ["realme rmx3231"],
    sourceApp: ["SC"],
    state: ["kerala"],
    time: ["2025-10-20 20:01:40"],
    userid: ["2118385968"]
  },
  {
    // Example 8: High floor price (₹41), female user
    ad_type: ["SC_CPCV_1"],
    adsuuid: ["a90046f2-ecb1-48ad-be71-6055f5520bfe"],
    ageRange: ["25-34"],
    city: ["kollam"],
    feed_fetch_counter: ["1"],
    gender: ["F"],
    language: ["tamil"],
    osVersion: ["rest"],
    phoneCarrier: ["ind airtel"],
    phoneModel: ["oppo cph2665"],
    sourceApp: ["SC"],
    state: ["kerala"],
    time: ["2025-10-20 18:20:31"],
    userid: ["964202151"]
  },
  {
    // Example 9: Telugu user, moderate engagement
    ad_type: ["SC_OUTSTREAM"],
    adsuuid: ["8ea67a61-30cd-4f91-a3d3-08fb884aed74"],
    ageRange: ["18-24"],
    city: ["west godavari"],
    feed_fetch_counter: ["4"],
    gender: ["M"],
    language: ["telugu"],
    osVersion: ["rest"],
    phoneCarrier: ["jio 4g"],
    phoneModel: ["lava lava lxx504"],
    sourceApp: ["SC"],
    state: ["andhra pradesh"],
    time: ["2025-10-20 15:21:13"],
    userid: ["3767690203"]
  },
  {
    // Example 10: Moj CPCV, Hindi user
    ad_type: ["MOJ_CPCV_2"],
    adsuuid: ["98729a04-d62f-4abf-a806-16af64da2dbe"],
    ageRange: ["18-24"],
    city: ["gondia"],
    feed_fetch_counter: ["2"],
    gender: ["M"],
    language: ["hindi"],
    osVersion: ["android 14 (34)"],
    phoneCarrier: ["jio true5g"],
    phoneModel: ["v2253"],
    sourceApp: ["MJ"],
    state: ["madhya pradesh"],
    time: ["2025-10-20 08:04:36"],
    userid: ["13436156741"]
  }
];

module.exports = {
  featureExamples,
  /**
   * Get example by index
   * @param {number} index - 0-based index
   * @returns {Object} - Feature example object
   */
  getExample: (index = 0) => {
    if (index < 0 || index >= featureExamples.length) {
      throw new Error(
        `Invalid example index: ${index}. Valid range: 0-${featureExamples.length - 1}`
      );
    }
    return featureExamples[index];
  },
  /**
   * Get all examples
   * @returns {Array} - All feature examples
   */
  getAll: () => featureExamples,
  /**
   * Get total count
   * @returns {number} - Total number of examples
   */
  getCount: () => featureExamples.length
};
