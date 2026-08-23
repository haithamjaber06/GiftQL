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
  useEffect(() => {
    fetch(`${API}/api/items`)
      .then((r) => r.json())
      .then((data) => setItems(data));
  }, []);

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

    setItems([created, ...items]);
    setUrl("");
    setError("");
  }

  async function removeItem(id) {
    await fetch(`${API}/api/items/${id}`, { method: "DELETE" });
    setItems(items.filter((item) => item.id !== id));
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
        <button className="chip" onClick={() => setFilter("")}>
          All
        </button>
        {people.map((name) => (
          <button key={name} className="chip" onClick={() => setFilter(name)}>
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
