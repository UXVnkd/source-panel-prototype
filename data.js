// data.js — single source of truth for the prototype.
// REAL SCENARIO: sources, passages and source lines are copied word for word
// from the published pages (checked November 2026). The answer is an example
// written for this demo: some claims deliberately drift from their sources.
// The original fictional version is kept in data-fictional.js.

window.PROTOTYPE_DATA = {
  question: "AI chat apps warn that they “can make mistakes. Check important info.” Are we concerned enough about this?",

  // Shown above the answer so viewers know the drift is staged.
  answerNote: "Example answer written for this demo. Sources and quotes are real; some claims drift from them on purpose.",

  // The answer, in reading order:
  //   a plain string           → connecting text
  //   { claim: "C1", after }   → a cited claim, plus optional punctuation
  answer: [
    "Probably not. The warning asks people to check, but few do. In Google search, ",
    { claim: "C2", after: "," },
    " and ",
    { claim: "C1", after: "." },
    " And checking isn't easy, because citations themselves often fall short: ",
    { claim: "C3", after: "," },
    " and ",
    { claim: "C4", after: "." }
  ],

  // Each claim shares one highlight color with its source line.
  // flags: phrases whose meaning changed between answer and source.
  claims: {
    C1: {
      text: "only 1% of people click the sources in AI answers",
      source: "S1",
      sourceLine: "This occurred in just 1% of all visits to pages with such a summary.",
      color: "amber",
      verdict: "mismatch",
      flags: {
        answer: ["1% of people", "AI answers"],
        source: ["1% of all visits", "pages with such a summary"]
      },
      note: "The source counted 1% of visits to Google search pages with an AI summary. The answer turns that into 1% of people, across all AI answers."
    },
    C2: {
      text: "users who saw an AI summary clicked a traditional search result in 8% of visits",
      source: "S1",
      sourceLine: "Users who encountered an AI summary clicked on a traditional search result link in 8% of all visits.",
      color: "sage",
      verdict: "match",
      flags: { answer: [], source: [] },
      note: "Same meaning as the source."
    },
    C3: {
      text: "31% of responses had serious sourcing problems",
      source: "S3",
      sourceLine: "31% of responses showed serious sourcing problems – missing, misleading, or incorrect attributions.",
      color: "lavender",
      verdict: "match",
      flags: { answer: [], source: [] },
      note: "Same meaning as the source. The study tested AI assistants' answers to news questions."
    },
    C4: {
      text: "about half of what AI search engines say is false",
      source: "S2",
      sourceLine: "a mere 51.5% of generated sentences are fully supported by citations",
      color: "rose",
      verdict: "mismatch",
      flags: {
        answer: ["is false"],
        source: ["fully supported by citations"]
      },
      note: "The study found about half of sentences weren't fully supported by their citations. That's a citation problem; it doesn't mean those sentences were false. It tested four search engines in 2023."
    }
  },

  // Sources. `label` is the short name on citation chips (styled like a site name).
  // `siteLabel` + `about` describe the whole site, not any single claim.
  // Each passage is copied from the page; "[…]" marks skipped text.
  // The passage must contain each claim's sourceLine word for word.
  sources: {
    S1: {
      label: "pewresearch",
      name: "Pew Research Center",
      type: "Analysis",
      siteLabel: "Research center",
      icon: "chart-column",
      about: "Publishes survey and data research on public attitudes and trends.",
      date: "July 2025",
      url: "https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/",
      passage:
        "Google users who encounter an AI summary are less likely to click on links to other websites than users who do not see one. " +
        "Users who encountered an AI summary clicked on a traditional search result link in 8% of all visits. " +
        "Those who did not encounter an AI summary clicked on a search result nearly twice as often (15% of visits). " +
        "Google users who encountered an AI summary also rarely clicked on a link in the summary itself. " +
        "This occurred in just 1% of all visits to pages with such a summary."
    },
    S2: {
      label: "arxiv",
      name: "Evaluating Verifiability in Generative Search Engines",
      type: "Paper",
      siteLabel: "Research paper archive",
      icon: "book-open",
      about: "Hosts research papers shared openly, often before or alongside peer review.",
      date: "April 2023",
      url: "https://arxiv.org/abs/2304.09848",
      passage:
        "Generative search engines directly generate responses to user queries, along with in-line citations. […] " +
        "We find that responses from existing generative search engines are fluent and appear informative, but frequently contain unsupported statements and inaccurate citations: on average, a mere 51.5% of generated sentences are fully supported by citations and only 74.5% of citations support their associated sentence. " +
        "We believe that these results are concerningly low for systems that may serve as a primary tool for information-seeking users, especially given their facade of trustworthiness."
    },
    S3: {
      label: "bbc",
      name: "BBC Media Centre",
      type: "Press release",
      siteLabel: "Broadcaster press office",
      icon: "megaphone",
      about: "Official press releases from the BBC. This one reports an EBU study led by the BBC.",
      date: "October 2025",
      url: "https://www.bbc.co.uk/mediacentre/2025/new-ebu-research-ai-assistants-news-content",
      passage:
        "Professional journalists from participating PSM evaluated more than 3,000 responses from ChatGPT, Copilot, Gemini, and Perplexity against key criteria, including accuracy, sourcing, distinguishing opinion from fact, and providing context. […] " +
        "45% of all AI answers had at least one significant issue. " +
        "31% of responses showed serious sourcing problems – missing, misleading, or incorrect attributions. " +
        "20% contained major accuracy issues, including hallucinated details and outdated information."
    }
  },

  // Demo mode (index.html?demo or #demo): captions and end card.
  demo: {
    captions: {
      hook:    "AI answers cite sources. But does the source say that?",
      open:    "The source comes to the claim.",
      link:    "Same color, same claim.",
      compare: "“1% of people” vs “1% of all visits”",
      match:   "It shows what holds up too.",
      feedback:"One tap to confirm or flag."
    },
    endCard: {
      title: "Bring the source to the claim.",
      byline: "[Your name] · [portfolio link]"
    }
  }
};
