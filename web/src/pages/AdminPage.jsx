import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { assignDriver, createDriver, fetchDrivers, fetchFleet, fetchOperators } from "../api";
import { useAuth } from "../context/AuthContext";

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [operators, setOperators] = useState([]);
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newDriver, setNewDriver] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [fleet, driverList, operatorList] = await Promise.all([
        fetchFleet(),
        fetchDrivers(),
        fetchOperators(),
      ]);
      setBuses(fleet.buses ?? []);
      setDrivers(driverList.drivers ?? []);
      setOperators(operatorList.operators ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const filteredBuses = useMemo(() => {
    if (operatorFilter === "all") return buses;
    return buses.filter((b) => b.operator === operatorFilter);
  }, [buses, operatorFilter]);

  async function handleAssignDriver(busId, driverId) {
    setMessage("");
    try {
      await assignDriver(busId, driverId || null);
      setMessage("Driver assignment updated.");
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreateDriver(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await createDriver({
        name: newDriver.name,
        email: newDriver.email || undefined,
        phone: newDriver.phone || undefined,
        password: newDriver.password,
      });
      setNewDriver({ name: "", email: "", phone: "", password: "" });
      setMessage("Driver account created.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  if (authLoading) return <p className="status">Loading…</p>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Fleet & driver assignment</h1>
          <p className="subtitle">
            Create driver accounts here, then assign them to Ambessa, Addis, and Shega buses. Drivers sign in at Driver login — they cannot self-register.
          </p>
        </div>
      </div>

      {message && <p className="status success">{message}</p>}
      {error && <p className="status error">{error}</p>}

      <section className="admin-section">
        <h2>Create driver</h2>
        <form className="driver-form" onSubmit={handleCreateDriver}>
          <input
            placeholder="Full name"
            value={newDriver.name}
            onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={newDriver.email}
            onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })}
          />
          <input
            placeholder="Phone"
            value={newDriver.phone}
            onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
          />
          <input
            placeholder="Password (min 6)"
            type="password"
            value={newDriver.password}
            onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
            required
            minLength={6}
          />
          <button type="submit" className="btn-primary">
            Add driver
          </button>
        </form>
      </section>

      <section className="admin-section">
        <div className="section-toolbar">
          <h2>Buses</h2>
          <div className="operator-tabs">
            <button
              type="button"
              className={operatorFilter === "all" ? "tab active" : "tab"}
              onClick={() => setOperatorFilter("all")}
            >
              All
            </button>
            {operators.map((op) => (
              <button
                key={op.id}
                type="button"
                className={operatorFilter === op.id ? "tab active" : "tab"}
                onClick={() => setOperatorFilter(op.id)}
              >
                {op.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="status">Loading fleet…</p>
        ) : (
          <div className="fleet-table-wrap">
            <table className="fleet-table">
              <thead>
                <tr>
                  <th>Bus</th>
                  <th>Operator</th>
                  <th>Routes</th>
                  <th>Assigned driver</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuses.map((bus) => (
                  <tr key={bus.id}>
                    <td>{bus.name}</td>
                    <td>
                      <span className={`operator-tag ${bus.operator ?? ""}`}>
                        {bus.operator ?? "—"}
                      </span>
                    </td>
                    <td>{bus.routeAssignmentsCount ?? 0}</td>
                    <td>{bus.driver?.name ?? "Unassigned"}</td>
                    <td>
                      <select
                        defaultValue={bus.driverId ?? ""}
                        onChange={(e) =>
                          handleAssignDriver(bus.id, e.target.value || null)
                        }
                      >
                        <option value="">— Unassigned —</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                            {d.email ? ` (${d.email})` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBuses.length === 0 && (
              <p className="status">No buses for this operator.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
