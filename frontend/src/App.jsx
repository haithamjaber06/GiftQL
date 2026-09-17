import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import Grid from "./components/Grid";
import InputBar from "./components/InputBar";
import FilterBar from "./components/FilterBar";
import BackgroundIllustration from "./components/BackgroundIllustration";
import { STATUS } from "./constants/status";
import { filterItems, occasionOptions } from "./utils/filterItems";

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

// Dev only: ?fixtures=1 swaps the API for local fake items. No requests are sent.
const fixturesMode =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("fixtures") === "1";

function api(path, options = {}) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { ...options.headers, "X-API-Key": API_KEY },
  });
}

const OFFLINE = "Can't reach the server";

function App() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [occasionFilter, setOccasionFilter] = useState("");
  const [priceFilter, setPriceFilter] = useState("");
  const pending = items.some((i) => i.status === STATUS.PENDING);

  const occasions = occasionOptions(items);
  // Selected occasion disappeared (e.g. its last item was deleted): reset to All.
  if (occasionFilter && !occasions.some((o) => o.key === occasionFilter)) {
    setOccasionFilter("");
  }
  const shown = filterItems(items, {
    person: personFilter,
    occasion: occasionFilter,
    price: priceFilter,
  });

  async function refresh() {
    if (fixturesMode) {
      const { fixtures } = await import("./dev/fixtures.js");
      setItems(fixtures);
      return;
    }
    try {
      const r = await api("/api/items");
      if (!r.ok) {
        setError(r.status === 401 ? "Can't reach the server — check the API key" : "Couldn't load items");
        return;
      }
      setItems(await r.json());
      setError("");
    } catch {
      setError(OFFLINE);
    }
  }

  useEffect(() => {
    if (!pending || fixturesMode) return;   // polling would reset local fixture edits
    let tries = 0;
    const id = setInterval(() => {
      if (++tries > 60) return clearInterval(id);   // give up after 2 minutes
      refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [pending]);

  useEffect(() => {
    refresh();
  }, []);

  // Resolves true when the item was saved (the input bar then clears itself).
  async function addItem({ url, person, occasion, price }) {
    if (!url.trim()) {
      setError("Please enter a URL");
      return false;
    }
    let created;
    if (fixturesMode) {
      console.log("[fixtures] create skipped");
      created = {
        id: Date.now(), url, norm_url: url, person, occasion,
        price: price === "" ? null : Number(price), currency: null,
        title: null, raw_title: null, description: null, img_url: null,
        status: STATUS.PENDING, kind: null, labels: [],
        created_at: new Date().toISOString(),
      };
    } else {
      try {
        const response = await api("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            person,
            occasion,
            price: price === "" ? null : price,
          }),
        });
        if (!response.ok) {
          const problem = await response.json().catch(() => ({}));
          setError(typeof problem.detail === "string" ? problem.detail : "Couldn't save that link");
          return false;
        }
        created = await response.json();
      } catch {
        setError(OFFLINE);
        return false;
      }
    }

    setItems((prev) => [created, ...prev]);
    setError("");
    return true;
  }

  // Resolves true if the item is gone, false if the delete failed.
  async function removeItem(id) {
    if (fixturesMode) {
      console.log("[fixtures] delete skipped");
    } else {
      try {
        const response = await api(`/api/items/${id}`, { method: "DELETE" });
        // 404 = already deleted elsewhere; the card should still go.
        if (!response.ok && response.status !== 404) return false;
      } catch {
        return false;   // network error
      }
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    return true;
  }

  // Optimistic: show the new values now, put the old ones back if the save fails.
  // Resolves true on success, false on failure.
  async function updateItem(id, fields) {
    const previous = items.find((i) => i.id === id);
    const reverted = Object.fromEntries(Object.keys(fields).map((key) => [key, previous[key]]));
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));

    if (fixturesMode) {
      console.log("[fixtures] edit skipped");
      return true;
    }
    try {
      const response = await api(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) throw new Error(`PATCH failed: ${response.status}`);
      const updated = await response.json();
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return true;
    } catch {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...reverted } : i)));
      return false;
    }
  }

  return (
    <Page>
      <BackgroundIllustration />
      <Header>
        <Title>GiftQL</Title>
        <InputBar onAdd={addItem} />
        {error && <ErrorLine role="alert">{error}</ErrorLine>}
      </Header>
      <FilterBar
        person={personFilter}
        onPersonChange={setPersonFilter}
        occasion={occasionFilter}
        onOccasionChange={setOccasionFilter}
        occasionOptions={occasions}
        price={priceFilter}
        onPriceChange={setPriceFilter}
      />
      <Grid
        items={shown}
        totalCount={items.length}
        person={personFilter}
        otherFiltersActive={Boolean(occasionFilter || priceFilter)}
        onDelete={removeItem}
        onUpdate={updateItem}
      />
    </Page>
  );
}

export default App;

// No background here — only <html> has one (spec §7.2).
const Page = styled.main`
  max-width: var(--grid-max-page-width);
  margin: 0 auto;
  padding: var(--space-page-block) var(--space-page-gutter);
  display: flex;
  flex-direction: column;
  gap: var(--space-section-gap);
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: var(--space-section-gap);
`;

const shimmer = keyframes`
  from { background-position: 0% 50%; }
  to   { background-position: 200% 50%; }
`;

// Brand-blue gradient clipped to the letters, slowly sweeping across.
// Filters: a solid light-blue offset copy gives it depth, then a page-colored
// halo around both keeps it crisp over the pattern.
const Title = styled.h1`
  align-self: flex-start;
  margin: 0;
  font-family: var(--font-body);
  font-size: var(--size-page-title);
  font-weight: var(--weight-medium);
  line-height: var(--line-height-title);
  letter-spacing: var(--tracking-title);

  background: linear-gradient(
    90deg,
    var(--color-card-bg) 0%,
    var(--color-border) 25%,
    var(--color-surface-raised) 50%,
    var(--color-border) 75%,
    var(--color-card-bg) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter:
    drop-shadow(var(--space-title-depth) var(--space-title-depth) 0 var(--color-text-muted))
    drop-shadow(0 0 var(--space-halo) var(--color-page-bg));
  animation: ${shimmer} var(--motion-title-shimmer) linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// Page-colored backing keeps the red readable over the pattern.
const ErrorLine = styled.p`
  align-self: flex-start;
  margin: 0;
  padding: 0 var(--space-halo);
  border-radius: var(--radius-input);
  background: var(--color-page-bg);
  box-shadow: 0 0 0 var(--space-halo) var(--color-page-bg);
  font-size: var(--size-error);
  color: var(--color-danger-on-light);
`;
