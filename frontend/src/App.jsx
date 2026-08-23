import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

function App() {
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState("");
  const [person, setPerson] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const people = ["Mom", "Dad", "Gf", "Big Sis", "Friend", "Teacher"];
  const shown = filter ? items.filter((item) => item.person === filter) : items;

  async function refresh() {
    const r = await fetch(`${API}/api/items`);
    setItems(await r.json());
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const pending = items.some((i) => i.status === "Pending");
    if (!pending) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [items]);

  async function addItem(event) {
    event.preventDefault();
    if (!url.trim()) {
      setError("Please Enter a URL");
      return;
    }
    const response = await fetch(`${API}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, person }),
    });
    if (!response.ok) {
      const problem = await response.json();
      setError(problem.detail);
      return;
    }
    const created = await response.json();

    setItems((prev) => [created, ...prev]);
    setUrl("");
    setError("");
  }

  async function removeItem(id) {
    await fetch(`${API}/api/items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="page">
      <h1>Gift Logger</h1>
      <form onSubmit={addItem} className="form">
        <input
          className="input"
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
        {shown.map((item) => (
          <li key={item.id} className="item">
            {item.img_url ? (
              <img src={item.img_url} alt={item.title} className="thumb" />
            ) : (
              <div className="thumb thumb-empty" />
            )}
            <div>
              <a href={item.url} className="title">
                {item.title || item.url}
              </a>
              <span className="person">{item.person || "Nobody Yet"}</span>
              {item.status === "Pending" && <div className="pending">Pending!</div>}
              {item.status === "Failed"  && <div className="failed">Failed</div>}
            </div>
            <button className="x" onClick={() => removeItem(item.id)}>
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
