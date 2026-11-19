// data.js — single source of truth for the prototype.
// Everything on screen is rendered from this object. All content is fictional.

window.PROTOTYPE_DATA = {
  question: "Do onboarding checklists improve activation?",

  // The answer is a list of pieces, in reading order:
  //   a plain string           → connecting text
  //   { claim: "C1", after }   → a cited claim, plus optional punctuation
  //                              placed after it (outside the highlight, before the chip)
  answer: [
    "Onboarding checklists are one of the most common activation tactics. ",
    { claim: "C1" },
    " ",
    { claim: "C2", after: "," },
    " and ",
    { claim: "C3", after: "." },
    " However, ",
    { claim: "C4", after: "," },
    " so the first step matters most."
  ],

  // Each claim shares one highlight color with its source line.
  // flags: phrases that changed meaning, marked in the compare view (step 5).
  claims: {
    C1: {
      text: "Onboarding checklists improve activation by 40%.",
      source: "S1",
      sourceLine: "In one company's test, checklists lifted activation by up to 40%.",
      color: "amber",
      verdict: "mismatch",
      flags: {
        answer: ["by 40%"],
        source: ["In one company's test", "by up to 40%"]
      },
      note: "The source says “up to 40%” in one company's test. The answer says 40%."
    },
    C2: {
      text: "They work best with 3 to 5 steps",
      source: "S2",
      sourceLine: "Teams saw the best completion rates with three to five steps.",
      color: "sage",
      verdict: "match",
      flags: { answer: [], source: [] },
      note: "Wording matches the source."
    },
    C3: {
      text: "adding a progress bar increases completion",
      source: "S2",
      sourceLine: "Adding a progress bar increased completion in our tests.",
      color: "lavender",
      verdict: "match",
      flags: { answer: [], source: [] },
      note: "Wording matches the source."
    },
    C4: {
      text: "most users abandon checklists after the first day",
      source: "S1",
      sourceLine: "Many users who skip the first step never return to the checklist.",
      color: "rose",
      verdict: "mismatch",
      flags: {
        answer: ["most users", "after the first day"],
        source: ["Many users", "who skip the first step"]
      },
      note: "The source says “many users who skip the first step” don't return. The answer says “most users” abandon “after the first day.”"
    }
  },

  // Sources. `label` is the short lowercase name shown on citation chips
  // (fictional, styled like a site name).
  // `siteLabel` + `about` describe the whole site (not any single claim)
  // and appear in the panel header.
  // The passage must contain each claim's sourceLine word for word.
  sources: {
    S1: {
      number: 1,
      label: "onboardingreview",
      name: "The Onboarding Review",
      type: "Blog",
      siteLabel: "Industry blog",
      icon: "newspaper",          // Lucide icon name (see icons.js)
      about: "An independent blog about SaaS onboarding.",
      date: "March 2026",
      url: "https://example.com/onboarding-checklists",
      passage:
        "Checklists have become a default pattern in SaaS onboarding. Results vary widely by product and audience. " +
        "In one company's test, checklists lifted activation by up to 40%. " +
        "Other teams reported smaller gains, and a few saw none. " +
        "Many users who skip the first step never return to the checklist. " +
        "That makes the first step the most important design decision."
    },
    S2: {
      number: 2,
      label: "productpatterns",
      name: "Product Patterns Quarterly",
      type: "Study",
      siteLabel: "Research report",
      icon: "book-open",
      about: "A quarterly review of onboarding flows across products.",
      date: "January 2026",
      url: "https://example.com/checklist-study",
      passage:
        "We reviewed onboarding flows across 120 products. " +
        "Teams saw the best completion rates with three to five steps. " +
        "Longer lists showed steady drop-off after the fifth item. " +
        "Adding a progress bar increased completion in our tests. " +
        "Effects were strongest for first-time users."
    }
  },

  // Demo mode (open index.html?demo): captions shown during the scripted
  // walkthrough, and the end card. Edit freely.
  demo: {
    captions: {
      hook:    "AI answers cite sources. But does the source say that?",
      open:    "The source comes to the claim.",
      link:    "Same color, same claim.",
      compare: "“40%” vs “up to 40%, in one company's test”",
      match:   "It shows what holds up too.",
      feedback:"One tap to confirm or flag."
    },
    endCard: {
      title: "Bring the source to the claim.",
      byline: "[Your name] · [portfolio link]"
    }
  }
};
