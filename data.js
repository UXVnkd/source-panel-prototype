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
  //   { claim, chip: false }   → claim highlighted, but its citation is collapsed into a pill
  //   { pill: ["C2", "C1"] }      → one collapsed pill for several citations in a sentence
  answer: [
    "Probably not. The warning asks people to check, but few do. In Google search, ",
    { claim: "C2", after: ",", chip: false },
    " and ",
    { claim: "C1", after: ".", chip: false },
    { pill: ["C2", "C1"] },
    " And checking isn't easy, because citations themselves often fall short: ",
    { claim: "C3", after: ",", chip: false },
    " and ",
    { claim: "C4", after: ".", chip: false },
    { pill: ["C3", "C4"] }
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
      // Triage: surfaced in the answer summary, with a short reason (priority 1 = first)
      attention: { priority: 1, reason: "Possible change in a number" },
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
      attention: { priority: 2, reason: "Possible change in an absolute claim" },
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
      // Site logo (favicon), shown beside the source name. Identity, not proof of accuracy.
      logo: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAA+CAYAAABzwahEAAAI20lEQVR4nO2be7BXVRXHP1foIcklBMWxgaksK1LqD3sYj0bIsdAyi3wQ4CWUp4+a6akzvZuomcwJBS4Xg0C4hmRF+cjJiMDIZJqUwh6SBqakqHFDpwz69cf3HM4+a6/z+P3uvdgMfmd+M+fsvc8++3vW2mutvfb+tQ0dOpQjEUc93wN4vvAC8SMNAw/DO8YD44BTgTcAO4Epps1e4AHgD8BvgJ8n9/2G/iQ+FtjilD/qlA1DH2dcUPYYcGI/jAvoX1W/G3iiF8//1CnrMxfUF8SPAmbhD3SZU9ZWs9+l5v6NwF+Bq4GX1h5dAXpL/K3AdmA5MAk43dTbwQM0avR7P/BLU3YZMBj4MvAg8OZmBmrRG+LTgc3A6KDsMtPmEeBHpqyOxBeb+0HAjOD+FWgqvbNGXy5aJX4usAp4sSmfCgw3ZUvMfZXEe4DVpqwDkQ8xCFn/ERX9uWiV+AZE3MOl5v4OYFdwXyXxG4FnTdnHnHYHgQ8Af6/oz0WrxBtICh75eabfBrHqlsG2HQ+8xpQdBD4EfL+JfnNohrg1XA3gYmTYQowEzjFlN5jnivAL4PembJ7T7iJ80m8r6TuHusTnImNyoVM3G+gyZQvM/V5gbXJdpurWCwxDkk1xAKn3zaZdG9AN/IxYO1zUIT4G+FbS+Vpi8g1i8mcCJ5l21shZPElMaDZZdHkAeD+xpMNxDQJ+SGwII9QhvgZ4UfCSbqTiFrPJ5mcbMN/UbwF+h6bMPvTBGsCfkvpliFyIucH1FOBW572ryQtjNPB5l0mAKuILgFOc8hX4ar+ATPKXAC8x9UuAlwPtQdlr0Qewan42MAp9jHOQJEMMQEL4sDOOj1Kh8lXEry4or5L89YjcVFO3CnjGeeY28i4PMqNWJOkb8T8+SEM/VVAHVBN/PXAFWi56WEE+okr7PCa5/rip248GbGHn/yhgMpK2DZIGALfgk24AdyJbMKdgzIcGWYYeYBFaR0/Ct6bfAWYGZTeTacJoYhdznbnfTSzRuUnfA4F15IOibuA8034f8E2k3mehafHfAk4aeAvJxhOSgV1Kfr3cAbwHuMC0X0U8JbYCb0+urwK+aur3IlcWYjpyZSHpbcigdgP/qksAiokfR7219BRkvc+oaHcs8HRwP50s6jsOEU1xISJShtVIE++tMcYROGFtkar/Bc2Vcys6XQ9MRLbgOjSHPYSqejJwdHL9EHJv4de3bjDFTuCTSdsZlJMejFaKfwQ6vQaexMeh5WaKXcnDy4HHS14G8DJgGhr8mKB8N3A+cC3FYeUNKBC5y5RvQOr8k4p3g2zKFcjFpQZ2PzAEM+c94p8FvlDQ8ToUxd1dYxBj0QewLq0OHkcfYimxm/NwASL8joL6tyB7cAge8fXABytetB25oCK/HGIyvh8uQg9yZ/sq2o1ERvYS4PiKtrOAb4cF3hw/ucbgTkXq9yia268raDcA+HqN/kK0A58pqGsD3o3U/2HkEapIg8PJk/itaK7WRZr+2Yg+xvqgbiLxnK2D/chApTgWGbTLgVcjj7Ojif7uAr4UFnh59bObG+Oh9fUZyW8PiteXks+TN4NjgNOQhC9H7i/E/cC7WuwbaC2ACTGMvA+2eJrWc+FPIB/vYRsyWC2jt+nl0rCwH1EnRV2K3hL/hzOIx4AvohTwtb3oezLK268kDkd7s0MD+Kr+YzLnXwepcduElqPhQqYvjdtMtN5/Fc0bt42Y2MQzbqOQu6qDHkR2EQoPLTahrIuXzCjDInP/FPAN4Bq0+pqPjHBdjd1mC7wHd9boaDsKHk4ki4k9HAQ+UXNwKXqAhQV1DZSnfx+S/ELqqX3EySNeRAIUS09AcXgn5VHbWJR0uL3GwEK0o0XSV1B0VoRdKNA5Hq0Ptpa0jTh5xO2c3IVSUCNQ8L85eiLD0Sj19FuUXEzzYbtRHH1PybPpxiPITV6VvHsDUu8yrEn6H4OSlqFAnsPZpy/y48+ghUgn8L2Kl4JC1vnIAA126j8NfC25PgkFOl1oWXol2khIY/MtSFssHkLrgy7kTcrQnoxlPsrivtc26G0i4nw016sSEcNR3jzFRWQbDCPIL3enIgmWYQWKDH9dY4xNJSLKSJ8AfA74G/BdMtId+IcDVpEnDfmdllmmbq3THqQZ6WbCTDRt7k2uyw4KuJuKzYSsE5HqeEvWjyApDEFSCFdDpwO/Cu5PQV4hxcPIQodYSD493Em2udBNnGHdhwKdRdTzSpV+ME3h7EBGz5JONw5XBAM4jcyS7yBPGuLU0iuJF0aLk74PoBR1uKMyjXgbaQjSiD+TubtSblXEt5Ollz1cTLxV/E8kRVDQEWIwcR4e8sRA1vwOFGA9aOrSfXEvIdlGll72jqEcQhVxm/ZN0UAGyp5cALmTeSgQsUZqGv5aP90uCpEOfD3+Unk6cFPB+P5DcRAEVBPvRD7ZoqPgpUvJMqpdwL9N/TzkinqCsp1IUnbnYwOS/EC0frCbCAfRx/d2Zq5BQVAh6sS6HWSro1TSVr3THZU5QTu7LTQWrQG2ojnZlvzSzb05xGuHcOt5Hb7kZ5AXwgPI65SiDvH7kOFoIB9rJd2GLGo4d+8ktq7eyYYQw4iPei4n2zoeCPyAmHw4rmeRYbOaFqHu6mYZOoviqXcXscG63twPx9/OtbAfZw95C56qvf1AqSZOIjaGLppJRNhceqreNgDxNgFtmyJMIN7X9k5S3EQ85yF2nYVoNQPjqXeKxeRTUt7piDJcae43EktxAEp4eORroVXi5+GThvgU1FnkXVVVvmwG8RkWm5gAkV/DYT7gdwsa4HOmfDVx1tVKu+qAXzuxPVhJbLAeQeHwYT3gByI5gfxpCWvURuIsCWvAHhezwdDt6BDvfS30DfQ+y3oPOk49G50xs4kGG4rWxZuId1WXIG2ahjKw3gquNnq7oVCFPcRz8DZ8X2yxkvwRE1C29am+GFh//kNhPIrQWsWZTlmfkIb+/U/KZpSDG5/80j/jeGdVniT/Z5xNNJc3bxr9rer/tzhi/3f2AvEjDf8DHd7ZetZRLCQAAAAASUVORK5CYII=", wide: false },
      label: "pewresearch",
      name: "Pew Research Center",
      type: "Analysis",
      siteLabel: "Research center",
      // Trust badge: the AI rates the site as reputable. Describes the site, not the claim.
      trusted: true,
      trustReason: "Nonpartisan research center that publishes its methods.",
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
      // Site logo (favicon), shown beside the source name. Identity, not proof of accuracy.
      logo: { src: "data:image/svg+xml,%3Csvg%20role%3D%22img%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20fill%3D%22%23B31B1B%22%20d%3D%22M3.8423%200a1.0037%201.0037%200%200%200-.922.6078c-.1536.3687-.0438.6275.2938%201.1113l6.9185%208.3597-1.0223%201.1058a1.0393%201.0393%200%200%200%20.003%201.4229l1.2292%201.3135-5.4391%206.4444c-.2803.299-.4538.823-.2971%201.1986a1.0253%201.0253%200%200%200%20.9585.635.9133.9133%200%200%200%20.6891-.3405l5.783-6.126%207.4902%208.0051a.8527.8527%200%200%200%20.6835.2597.9575.9575%200%200%200%20.8777-.6138c.1577-.377-.017-.7502-.306-1.1407l-7.0518-8.3418%201.0632-1.13a.9626.9626%200%200%200%20.0089-1.3165L4.6336.4639s-.3733-.4535-.768-.463zm0%20.272h.0166c.2179.0052.4874.2715.5644.3639l.005.006.0052.0055%2010.169%2010.9905a.6915.6915%200%200%201-.0072.945l-1.0666%201.133-1.4982-1.7724-8.5994-10.39c-.3286-.472-.352-.6183-.2592-.841a.7307.7307%200%200%201%20.6704-.4401Zm14.341%201.5701a.877.877%200%200%200-.6554.2418l-5.6962%206.1584%201.6944%201.8319%205.3089-6.5138c.3251-.4335.479-.6603.3247-1.0292a1.1205%201.1205%200%200%200-.9763-.689zm-7.6557%2012.2823%201.3186%201.4135-5.7864%206.1295a.6494.6494%200%200%201-.4959.26.7516.7516%200%200%201-.706-.4669c-.1119-.2682.0359-.6864.2442-.9083l.0051-.0055.0047-.0055z%22/%3E%3C/svg%3E", wide: false },
      label: "arxiv",
      name: "Evaluating Verifiability in Generative Search Engines",
      type: "Paper",
      siteLabel: "Research paper archive",
      trusted: false,              // hosts preprints that aren't always peer-reviewed
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
      // Site logo (favicon), shown beside the source name. Identity, not proof of accuracy.
      logo: { src: "data:image/svg+xml,%3Csvg%20width%3D%22112%22%20height%3D%2232%22%20viewBox%3D%220%200%20112%2032%22%20fill%3D%22%23000%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%20%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M8.99999%206.99999H15.7552C17.7458%206.99999%2019.2878%207.39887%2020.3811%208.19576C21.4741%208.99309%2022.021%2010.1385%2022.021%2011.6321C22.021%2012.4881%2021.8252%2013.2308%2021.4335%2013.8601C21.0419%2014.4894%2020.4625%2014.9891%2019.6958%2015.358C20.7563%2015.7104%2021.5682%2016.2686%2022.1311%2017.0321C22.6941%2017.796%2022.9755%2018.7232%2022.9755%2019.814C22.9755%2020.8882%2022.7021%2021.8114%2022.1555%2022.5832C21.6087%2023.3553%2020.8296%2023.9513%2019.8182%2024.3706C18.8062%2024.7903%2017.5909%2025%2016.1713%2025H8.99999V6.99999ZM0%2032H32V0H0V32ZM48.9999%206.99999H55.7551C57.7457%206.99999%2059.2877%207.39887%2060.3811%208.19576C61.4741%208.99309%2062.0209%2010.1385%2062.0209%2011.6321C62.0209%2012.4881%2061.8251%2013.2308%2061.4334%2013.8601C61.0419%2014.4894%2060.4624%2014.9891%2059.6957%2015.358C60.7562%2015.7104%2061.568%2016.2686%2062.1311%2017.0321C62.694%2017.796%2062.9753%2018.7232%2062.9753%2019.814C62.9753%2020.8882%2062.7019%2021.8114%2062.1554%2022.5832C61.6087%2023.3553%2060.8297%2023.9513%2059.818%2024.3706C58.8062%2024.7903%2057.5908%2025%2056.1712%2025H48.9999V6.99999ZM39.9999%2032H71.9999V0H39.9999V32ZM55.8775%2017.2209H52.6469V22.0797H55.8286C56.9216%2022.0797%2057.7622%2021.8743%2058.3497%2021.4629C58.9369%2021.0518%2059.2308%2020.4602%2059.2308%2019.6881C59.2308%2018.0435%2058.1128%2017.2209%2055.8775%2017.2209ZM55.4125%209.92026C57.3541%209.92026%2058.3252%2010.6338%2058.3252%2012.06C58.3252%2012.7988%2058.0763%2013.3735%2057.5787%2013.7846C57.0808%2014.196%2056.3588%2014.4014%2055.4125%2014.4014H52.6469V9.92026H55.4125ZM15.4126%209.92026C17.3542%209.92026%2018.3253%2010.6338%2018.3253%2012.06C18.3253%2012.7988%2018.0763%2013.3735%2017.5787%2013.7846C17.0808%2014.196%2016.3588%2014.4014%2015.4126%2014.4014H12.6469V9.92026H15.4126ZM15.8776%2017.2209H12.6469V22.0797H15.8287C16.9217%2022.0797%2017.7623%2021.8743%2018.3497%2021.4629C18.937%2021.0518%2019.2308%2020.4602%2019.2308%2019.6881C19.2308%2018.0435%2018.1129%2017.2209%2015.8776%2017.2209ZM100.391%2024.8338C101.373%2024.5956%20102.237%2024.2706%20102.982%2023.8592V20.4292C101.407%2021.4001%2099.6879%2021.8851%2097.8249%2021.8851C96.6052%2021.8851%2095.5677%2021.6549%2094.7125%2021.1942C93.857%2020.7338%2093.2048%2020.0633%2092.7562%2019.1831C92.3071%2018.3032%2092.0829%2017.238%2092.0829%2015.9876C92.0829%2014.7377%2092.3155%2013.6766%2092.7814%2012.8045C93.2472%2011.9327%2093.9161%2011.2665%2094.7887%2010.8058C95.6608%2010.3454%2096.7153%2010.1148%2097.9519%2010.1148C98.8494%2010.1148%2099.705%2010.2343%20100.518%2010.4726C101.331%2010.7113%20102.084%2011.0609%20102.779%2011.5212V8.01737C102.017%207.62259%20101.191%207.32259%20100.302%207.1167C99.4128%206.91126%2098.4683%206.80826%2097.4691%206.80826C96.0292%206.80826%2094.7292%207.02226%2093.5691%207.44981C92.4088%207.87781%2091.4136%208.4947%2090.5839%209.30048C89.7537%2010.1067%2089.1187%2011.0732%2088.6783%2012.1999C88.2377%2013.3269%2088.0176%2014.5896%2088.0176%2015.9876C88.0176%2017.4188%2088.2295%2018.7062%2088.6529%2019.8493C89.0761%2020.9929%2089.6859%2021.9591%2090.4822%2022.7488C91.2782%2023.5383%2092.252%2024.143%2093.404%2024.5624C94.5557%2024.9819%2095.8515%2025.1917%2097.2912%2025.1917C98.375%2025.1917%2099.4085%2025.0721%20100.391%2024.8338ZM112%2032H79.9998V4.44444e-05H112V32Z%22/%3E%20%3C/svg%3E", wide: true },
      label: "bbc",
      name: "BBC Media Centre",
      type: "Press release",
      siteLabel: "Broadcaster press office",
      trusted: true,
      trustReason: "Official press office of a public broadcaster, reporting a named study.",
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
