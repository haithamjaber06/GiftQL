import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

function App() {
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState("");
  const [person, setPerson] = useState("");
  const [occasion, setOccasion] = useState("");
  const [price, setPrice] = useState("")
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const people = ["Mom", "Dad", "Gf", "Big Sis", "Friend", "Teacher"];
  const shown = filter ? items.filter((item) => item.person === filter) : items;
  const pending = items.some((i) => i.status === "Pending");

  async function refresh() {
    const r = await fetch(`${API}/api/items`);
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
    const response = await fetch(`${API}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, person, occasion, price: price === "" ? null : price}),
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
    await fetch(`${API}/api/items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((item) => item.id !== id));
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
        {shown.map((item) => (
          <li key={item.id} className="item">
            <div className="box box-title">
              {item.img_url ? (
                <img src={item.img_url} alt="" className="thumb" />
              ) : (
                <div className="thumb thumb-empty" />
              )}
              <div className="title-text">
                <a href={item.url} className="title">
                  {item.title || item.url}
                </a>
                {item.status === "Pending" && (
                  <div className="pending">Pending!</div>
                )}
                {item.status === "Failed" && <div className="failed">Failed</div>}
              </div>
              <button className="x" onClick={() => removeItem(item.id)}>
                X
              </button>
            </div>

            <div className="box box-sq box-person">{item.person || "?"}</div>
            <div className="box box-sq box-occasion">{item.occasion || "?"}</div>
            <div className="box box-sq box-price">{item.price ?? "?"}</div>

          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
