/** How-to guide (English). Structure mirrors ja.tsx. */
export function HowToEn() {
  return (
    <>
      <h2>Getting started</h2>
      <p>
        EkiHub finds the station that works best for everyone, based on where
        each person is coming from.
      </p>

      <h3>1. Enter the stations</h3>
      <p>
        Use the “Enter nearest stations” panel on the left. You can type in
        kanji, kana or romaji — “しんじゅく” and “shinjuku” both find Shinjuku.
        <br />
        Press “Add a station” for more fields. If several people start from the
        same station, set the number on the right; it weights both the centroid
        and the average travel time.
      </p>

      <h3>2. Narrow down the candidates</h3>
      <p>Pick the search mode that fits the occasion.</p>
      <ul>
        <li>
          <strong>Major stations only:</strong> large hubs such as Shinjuku,
          Shibuya or Tokyo — easy to transfer at, plenty of places nearby. Best
          for meals and nights out.
        </li>
        <li>
          <strong>Any size:</strong> purely the shortest travel time, including
          smaller local stations.
        </li>
      </ul>

      <h3>3. Set what matters</h3>
      <p>The sliders adjust the balance.</p>
      <ul>
        <li>
          <strong>Closeness:</strong> minimises the total travel time across
          everyone (overall efficiency).
        </li>
        <li>
          <strong>Fairness:</strong> minimises the spread, so nobody is left
          with a much longer trip than the rest.
        </li>
        <li>
          <strong>Fares:</strong> favours stations with a lower average fare.
        </li>
      </ul>

      <h3>4. Search</h3>
      <p>
        Press “Find the midpoint station”. The suggestion appears on the right,
        along with travel time from each station and a map of the relative
        positions.
        <br />
        Pick a different station from the ranking to see the numbers for that
        one instead.
      </p>

      <h3>5. Share</h3>
      <p>
        “Copy URL” turns the current conditions into a link. Whoever opens it
        gets the same result calculated automatically, so you can drop it
        straight into a chat. There is also a QR code for handing it to a phone.
      </p>
    </>
  );
}
