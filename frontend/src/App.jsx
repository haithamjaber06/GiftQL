import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

function api(path, options = {}) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { ...options.headers, "X-API-Key": API_KEY },
  });
}

function App() {
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState("");
  const [person, setPerson] = useState("");
  const [occasion, setOccasion] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null); // { id, field } or null
  const [draft, setDraft] = useState("");
  const KINDS = ["Product", "Store", "Idea", "Inspo"];
  const people = ["Mom", "Dad", "Gf", "Big Sis", "Friend", "Teacher"];
  const shown = filter ? items.filter((item) => item.person === filter) : items;
  const pending = items.some((i) => i.status === "Pending");

  async function refresh() {
    const r = await api("/api/items");
    setItems(await r.json());
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [pending]);

  async function addItem(event) {
    event.preventDefault();
    if (!url.trim()) {
      setError("Please Enter a URL");
      return;
    }
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
      const problem = await response.json();
      setError(typeof problem.detail === "string" ? problem.detail : "Error!");
      return;
    }
    const created = await response.json();

    setItems((prev) => [created, ...prev]);
    setUrl("");
    setOccasion("");
    setPrice("");
    setError("");
  }

  async function removeItem(id) {
    await api(`/api/items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function startEdit(item, field) {
    setEditing({ id: item.id, field });
    setDraft(item[field] ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    const { id, field } = editing;
    const item = items.find((i) => i.id === id);
    setEditing(null);

    // nothing changed (also how Escape becomes a no-op)
    if (String(item[field] ?? "") === String(draft)) return;

    const value =
      field === "price" ? (draft === "" ? null : Number(draft)) : draft;

    const response = await api(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!response.ok) {
      setError("Couldn't save that");
      return;
    }
    const updated = await response.json();
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  function isEditing(item, field) {
    return editing && editing.id === item.id && editing.field === field;
  }

  function editable(item, field, display) {
    if (!isEditing(item, field)) {
      return (
        <span className="editable" onClick={() => startEdit(item, field)}>
          {display}
        </span>
      );
    }
    return (
      <input
        className="edit"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={saveEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
          if (e.key === "Escape") {
            setDraft(item[field] ?? "");
            e.target.blur();
          }
        }}
      />
    );
  }

  return (
    <div className="page">
      <h1>Gift Logger</h1>
      <form onSubmit={addItem} className="form">
        <input
          className="input input-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a Link"
        />
        <select
          className="input"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        >
          <option value="">Person</option>
          <option>Mom</option>
          <option>Dad</option>
          <option>Gf</option>
          <option>Big Sis</option>
          <option>Friend</option>
          <option>Teacher</option>
        </select>
        <input
          type="text"
          className="input input-occasion"
          list="occasion-list"
          placeholder="Occasion..."
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
        />
        <datalist id="occasion-list">
          <option value="Birthday" />
          <option value="Anniversary" />
          <option value="Graduation" />
          <option value="Wedding" />
          <option value="Eid" />
          <option value="Valentine's" />
          <option value="Mother's Day" />
          <option value="Father's Day" />
          <option value="Just Because" />
        </datalist>
        <input
          type="number"
          className="input input-price"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button className="button">Save</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="filters">
        <button
          className={filter === "" ? "chip chip-on" : "chip"}
          onClick={() => setFilter("")}
        >
          All
        </button>
        {people.map((name) => (
          <button
            key={name}
            className={filter === name ? "chip chip-on" : "chip"}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <ul className="list">
        {shown.map((item) => {
          const enriched = item.status === "Done";
          return (
            <li key={item.id} className={enriched ? "item" : "item item-partial"}>
              <div className="box box-title">
                {item.img_url ? (
                  <a href={item.url} target="_blank"><img src={item.img_url} alt="" className="thumb" /></a>
                ) : (
                  <div className="thumb thumb-empty" />
                )}
                <div className="title-text">
                  <div className="title">
                    {editable(item, "title", item.title || item.url)}{" "}
                    <a href={item.url} title="open link" target="_blank">
                      &#8599;
                    </a>
                  </div>
                  {enriched && item.description && (
                    <div className="desc">{item.description}</div>
                  )}
                  {item.status === "Pending" && (
                    <div className="pending">Pending!</div>
                  )}
                  {item.status === "Partial" && (
                    <div className="partial">Partial</div>
                  )}
                  {item.status === "Failed" && (
                    <div className="failed">Failed</div>
                  )}
                </div>
                <button className="x" onClick={() => removeItem(item.id)}>
                  X
                </button>
              </div>
              {enriched && (
                <div className="box box-kind">
                  <div className="kind">
                    {isEditing(item, "kind") ? (
                      <select
                        className="edit"
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={saveEdit}
                      >
                        {KINDS.map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="editable"
                        onClick={() => startEdit(item, "kind")}
                      >
                        {item.kind || "?"}
                      </span>
                    )}
                  </div>
                  {item.labels?.length > 0 && (
                    <ul className="labels">
                      {item.labels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              
              <div className="box box-sq box-person">{item.person || "?"}</div>
              <div className="box box-sq box-occasion">
                {item.occasion || "?"}
              </div>
              <div className="box box-sq box-price">
                {editable(item, "price", item.price ?? "\u2014")}
                {enriched && item.price != null && item.currency
                  ? ` ${item.currency}`
                  : ""}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default App;
