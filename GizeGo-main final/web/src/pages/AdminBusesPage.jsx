import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  assignBusToRoute,
  createBus,
  createOperator,
  deleteBus,
  deleteOperator,
  fetchBus,
  fetchBuses,
  fetchOperators,
  fetchRoutes,
  unassignBusFromRoute,
  updateBus,
  updateOperator,
} from "../api";
import { useAuth } from "../context/AuthContext";

const STATUSES = [
  { id: "active", label: "Active" },
  { id: "maintenance", label: "Maintenance" },
  { id: "inactive", label: "Inactive" },
  { id: "out_of_service", label: "Out of service" },
];

const emptyOperatorForm = () => ({ name: "" });
const emptyBusForm = (operatorId = "") => ({
  name: "",
  operator: operatorId,
  status: "active",
});
const emptyRouteAssignForm = () => ({
  routeId: "",
});

function statusLabel(status) {
  return STATUSES.find((s) => s.id === status)?.label ?? status ?? "Active";
}

function operatorName(operators, operatorId) {
  return operators.find((o) => o.id === operatorId)?.name ?? operatorId ?? "—";
}

function routeLabel(routes, routeId) {
  const route = routes.find((r) => r.id === routeId);
  if (!route) return routeId;
  return route.code ? `${route.code} · ${route.name}` : route.name;
}

export default function AdminBusesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [operators, setOperators] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [operatorFilter, setOperatorFilter] = useState("all");
  /** @type {"idle" | "add" | "edit"} */
  const [busPanelMode, setBusPanelMode] = useState("idle");
  const [operatorForm, setOperatorForm] = useState(emptyOperatorForm());
  const [editingOperatorId, setEditingOperatorId] = useState(null);
  const [busForm, setBusForm] = useState(emptyBusForm());
  const [busDetail, setBusDetail] = useState(null);
  const [routeAssignForm, setRouteAssignForm] = useState(emptyRouteAssignForm());
  const [loading, setLoading] = useState(true);
  const [loadingBusDetail, setLoadingBusDetail] = useState(false);
  const [submittingOperator, setSubmittingOperator] = useState(false);
  const [submittingBus, setSubmittingBus] = useState(false);
  const [submittingRouteAssign, setSubmittingRouteAssign] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedBus = useMemo(
    () => buses.find((b) => b.id === selectedBusId) ?? null,
    [buses, selectedBusId],
  );

  const filteredBuses = useMemo(() => {
    if (operatorFilter === "all") return buses;
    return buses.filter((b) => b.operator === operatorFilter);
  }, [buses, operatorFilter]);

  const assignedRouteIds = useMemo(
    () => new Set((busDetail?.routeAssignments ?? []).map((a) => a.routeId)),
    [busDetail],
  );

  const availableRoutes = useMemo(
    () => routes.filter((r) => !assignedRouteIds.has(r.id)),
    [routes, assignedRouteIds],
  );

  const selectedRoutePreview = useMemo(
    () => routes.find((r) => r.id === routeAssignForm.routeId) ?? null,
    [routes, routeAssignForm.routeId],
  );

  const loadBusDetail = useCallback(async (busId) => {
    if (!busId) {
      setBusDetail(null);
      return;
    }
    setLoadingBusDetail(true);
    try {
      const data = await fetchBus(busId);
      setBusDetail(data.bus ?? null);
    } catch (e) {
      setError(e.message);
      setBusDetail(null);
    } finally {
      setLoadingBusDetail(false);
    }
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [operatorData, busData, routeData] = await Promise.all([
        fetchOperators(),
        fetchBuses(),
        fetchRoutes(),
      ]);
      const opList = operatorData.operators ?? [];
      const busList = busData.buses ?? [];
      setOperators(opList);
      setBuses(busList);
      setRoutes(routeData.routes ?? []);
      setSelectedBusId((current) =>
        current && busList.some((b) => b.id === current) ? current : null,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  useEffect(() => {
    if (busPanelMode === "edit" && selectedBusId) {
      loadBusDetail(selectedBusId);
    } else if (busPanelMode !== "edit") {
      setBusDetail(null);
    }
  }, [busPanelMode, selectedBusId, loadBusDetail]);

  function resetRouteAssignForm() {
    setRouteAssignForm(emptyRouteAssignForm());
  }

  function resetOperatorForm() {
    setOperatorForm(emptyOperatorForm());
    setEditingOperatorId(null);
  }

  function resetBusPanel() {
    setSelectedBusId(null);
    setBusPanelMode("idle");
    setBusForm(emptyBusForm(operators[0]?.id ?? ""));
    resetRouteAssignForm();
    setBusDetail(null);
  }

  function handleSelectBus(bus) {
    setSelectedBusId(bus.id);
    setBusPanelMode("edit");
    setBusForm({
      name: bus.name,
      operator: bus.operator ?? operators[0]?.id ?? "",
      status: bus.status ?? "active",
    });
    resetRouteAssignForm();
    setMessage("");
    setError("");
  }

  function handleStartAddBus() {
    setSelectedBusId(null);
    setBusPanelMode("add");
    setBusForm(emptyBusForm(operators[0]?.id ?? ""));
    resetRouteAssignForm();
    setBusDetail(null);
    setMessage("");
    setError("");
  }

  function handleEditOperator(operator) {
    setEditingOperatorId(operator.id);
    setOperatorForm({ name: operator.name });
    setMessage("");
    setError("");
  }

  async function handleOperatorSubmit(e) {
    e.preventDefault();
    setSubmittingOperator(true);
    setMessage("");
    setError("");
    try {
      if (editingOperatorId) {
        await updateOperator(editingOperatorId, { name: operatorForm.name.trim() });
        setMessage("Operator updated.");
      } else {
        await createOperator({ name: operatorForm.name.trim() });
        setMessage("Operator added.");
      }
      resetOperatorForm();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingOperator(false);
    }
  }

  async function handleDeleteOperator(operator) {
    if (operator.busCount > 0) {
      setError(
        `Cannot delete "${operator.name}" while ${operator.busCount} bus(es) are assigned. Reassign or delete those buses first.`,
      );
      return;
    }
    if (!window.confirm(`Delete operator "${operator.name}"?`)) return;

    setMessage("");
    setError("");
    try {
      await deleteOperator(operator.id);
      if (editingOperatorId === operator.id) resetOperatorForm();
      resetBusPanel();
      setMessage("Operator deleted.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBusSubmit(e) {
    e.preventDefault();
    if (!busForm.operator) {
      setError("Choose an operator for this bus.");
      return;
    }

    const wantsRoute = Boolean(routeAssignForm.routeId);

    setSubmittingBus(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        name: busForm.name.trim(),
        operator: busForm.operator,
        status: busForm.status,
      };

      if (busPanelMode === "edit" && selectedBusId) {
        await updateBus(selectedBusId, payload);
        setMessage("Bus updated.");
      } else {
        if (wantsRoute) {
          payload.routeId = routeAssignForm.routeId;
        }
        const created = await createBus(payload);
        setMessage(wantsRoute ? "Bus added and route assigned." : "Bus added.");
        if (created?.bus?.id) {
          setSelectedBusId(created.bus.id);
          setBusPanelMode("edit");
          setBusForm({
            name: created.bus.name,
            operator: created.bus.operator ?? busForm.operator,
            status: created.bus.status ?? "active",
          });
          setBusDetail(created.bus);
          resetRouteAssignForm();
        } else {
          resetBusPanel();
        }
      }
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingBus(false);
    }
  }

  async function handleRouteAssignSubmit(e) {
    e.preventDefault();
    if (!selectedBusId || !routeAssignForm.routeId) {
      setError("Choose a route from the list.");
      return;
    }

    setSubmittingRouteAssign(true);
    setMessage("");
    setError("");
    try {
      await assignBusToRoute(routeAssignForm.routeId, {
        busId: selectedBusId,
      });
      setMessage("Route assigned to bus.");
      resetRouteAssignForm();
      await Promise.all([loadBusDetail(selectedBusId), loadData()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingRouteAssign(false);
    }
  }

  async function handleUnassignRoute(routeId, routeName) {
    if (!selectedBusId) return;
    if (!window.confirm(`Remove route "${routeName}" from this bus?`)) return;

    setMessage("");
    setError("");
    try {
      await unassignBusFromRoute(routeId, selectedBusId);
      resetRouteAssignForm();
      setMessage("Route removed from bus.");
      await Promise.all([loadBusDetail(selectedBusId), loadData()]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSelectedBus() {
    if (!selectedBus) return;
    if (!window.confirm(`Delete bus "${selectedBus.name}"?`)) return;

    setMessage("");
    setError("");
    try {
      await deleteBus(selectedBus.id);
      resetBusPanel();
      setMessage("Bus deleted.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  function renderRouteAssignFields() {
    return (
      <>
        <label className="field-label">
          Route from map
          <select
            value={routeAssignForm.routeId}
            onChange={(e) => setRouteAssignForm({ routeId: e.target.value })}
          >
            <option value="">— Select route —</option>
            {availableRoutes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.code ? `${route.code} · ` : ""}
                {route.name}
              </option>
            ))}
          </select>
        </label>
        {selectedRoutePreview ? (
          <p className="subtitle section-note">
            Uses the full route path already created on the Routes page
            {selectedRoutePreview.durationMinutes != null
              ? ` · ${selectedRoutePreview.durationMinutes} min`
              : ""}
            {selectedRoutePreview.distanceMeters != null
              ? ` · ${(selectedRoutePreview.distanceMeters / 1000).toFixed(1)} km`
              : ""}
            .
          </p>
        ) : null}
      </>
    );
  }

  if (authLoading) return <p className="status">Loading…</p>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Operator &amp; bus management</h1>
          <p className="subtitle">
            Add buses, assign operators, and link each bus to routes already created on the Routes
            page.
          </p>
        </div>
      </div>

      {message && <p className="status success">{message}</p>}
      {error && <p className="status error">{error}</p>}

      <section className="admin-section">
        <h2>{editingOperatorId ? "Update operator" : "Add operator"}</h2>
        <form className="driver-form bus-form" onSubmit={handleOperatorSubmit}>
          <input
            placeholder="Operator name (e.g. Ambessa, Addis, Shega)"
            value={operatorForm.name}
            onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
            required
            maxLength={120}
          />
          <button type="submit" className="btn-primary" disabled={submittingOperator}>
            {submittingOperator ? "Saving…" : editingOperatorId ? "Save operator" : "Add operator"}
          </button>
          {editingOperatorId && (
            <button type="button" className="btn-secondary" onClick={resetOperatorForm}>
              Cancel edit
            </button>
          )}
        </form>
      </section>

      <section className="admin-section">
        <h2>Operators ({operators.length})</h2>
        {loading ? (
          <p className="status">Loading…</p>
        ) : (
          <div className="fleet-table-wrap">
            <table className="fleet-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Buses</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id}>
                    <td>
                      <span className={`operator-tag ${operator.id}`}>{operator.name}</span>
                    </td>
                    <td>{operator.id}</td>
                    <td>{operator.busCount ?? 0}</td>
                    <td className="row-actions">
                      <button type="button" className="btn-text" onClick={() => handleEditOperator(operator)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDeleteOperator(operator)}
                        disabled={operator.busCount > 0}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {operators.length === 0 && (
              <p className="status">Add an operator first, then you can assign buses to it.</p>
            )}
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="section-toolbar">
          <h2>Bus management</h2>
          <button
            type="button"
            className="btn-primary small"
            onClick={handleStartAddBus}
            disabled={operators.length === 0}
          >
            Add new bus
          </button>
        </div>

        {operators.length === 0 ? (
          <p className="status">Create at least one operator before adding buses.</p>
        ) : (
          <>
            {(busPanelMode === "add" || busPanelMode === "edit") && (
              <div className="bus-panel inline-panel">
                <h3>{busPanelMode === "add" ? "Add new bus" : `Edit bus — ${selectedBus?.name ?? ""}`}</h3>
                <p className="subtitle section-note">
                  Enter the bus details and choose which operator this bus belongs to.
                </p>

                <form className="driver-form bus-form" onSubmit={handleBusSubmit}>
                  <label className="field-label">
                    Bus number / plate
                    <input
                      placeholder="e.g. 01, AA-1234"
                      value={busForm.name}
                      onChange={(e) => setBusForm({ ...busForm, name: e.target.value })}
                      required
                      maxLength={120}
                    />
                  </label>
                  <label className="field-label">
                    Choose operator
                    <select
                      value={busForm.operator}
                      onChange={(e) => setBusForm({ ...busForm, operator: e.target.value })}
                      required
                    >
                      <option value="">— Select operator —</option>
                      {operators.map((op) => {
                        const count = buses.filter((b) => b.operator === op.id).length;
                        return (
                          <option key={op.id} value={op.id}>
                            {op.name} ({count} bus{count === 1 ? "" : "es"})
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="field-label">
                    Assign status
                    <select
                      value={busForm.status}
                      onChange={(e) => setBusForm({ ...busForm, status: e.target.value })}
                      required
                    >
                      {STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={submittingBus || !busForm.operator}
                    >
                      {submittingBus
                        ? "Saving…"
                        : busPanelMode === "edit"
                          ? "Update bus"
                          : "Add bus"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={resetBusPanel}>
                      Cancel
                    </button>
                    {busPanelMode === "edit" && selectedBus && (
                      <button
                        type="button"
                        className="btn-danger solid"
                        onClick={handleDeleteSelectedBus}
                      >
                        Delete bus
                      </button>
                    )}
                  </div>
                </form>

                {busPanelMode === "add" && routes.length > 0 && (
                  <div className="route-assign-section">
                    <h4>Assign route (optional)</h4>
                    <p className="subtitle section-note">
                      Pick a route from the list. Stops and path come from the route already on the
                      map.
                    </p>
                    <div className="driver-form bus-form route-assign-form">
                      {renderRouteAssignFields()}
                    </div>
                  </div>
                )}

                {busPanelMode === "add" && routes.length === 0 && (
                  <p className="status section-note">
                    Create routes on the Routes page before assigning them to buses.
                  </p>
                )}

                {busPanelMode === "edit" && (
                  <div className="route-assign-section">
                    <h4>Scheduled routes</h4>
                    {loadingBusDetail ? (
                      <p className="status">Loading route assignments…</p>
                    ) : (busDetail?.routeAssignments ?? []).length > 0 ? (
                      <div className="fleet-table-wrap">
                        <table className="fleet-table">
                          <thead>
                            <tr>
                              <th>Route</th>
                              <th>From</th>
                              <th>To</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {busDetail.routeAssignments.map((a) => (
                              <tr key={a.routeId}>
                                <td>{routeLabel(routes, a.routeId) || a.routeName}</td>
                                <td>{a.departureStopName ?? "—"}</td>
                                <td>{a.arrivalStopName ?? "—"}</td>
                                <td className="row-actions">
                                  <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={() =>
                                      handleUnassignRoute(
                                        a.routeId,
                                        routeLabel(routes, a.routeId) || a.routeName,
                                      )
                                    }
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="subtitle section-note">No routes assigned to this bus yet.</p>
                    )}

                    {routes.length > 0 ? (
                      <form
                        className="driver-form bus-form route-assign-form"
                        onSubmit={handleRouteAssignSubmit}
                      >
                        <h4>Assign another route</h4>
                        <p className="subtitle section-note">
                          Choose a route from those already created on the Routes page.
                        </p>
                        {renderRouteAssignFields()}
                        {routeAssignForm.routeId ? (
                          <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={submittingRouteAssign}>
                              {submittingRouteAssign ? "Saving…" : "Assign route"}
                            </button>
                          </div>
                        ) : null}
                      </form>
                    ) : (
                      <p className="status section-note">
                        Create routes on the Routes page before assigning them to buses.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {busPanelMode === "idle" && (
              <p className="status section-note">
                Click <strong>Add new bus</strong> to create a bus and assign routes, or select a bus
                below to edit details and linked routes.
              </p>
            )}

            <div className="section-toolbar filter-toolbar">
              <h3>Available buses ({filteredBuses.length})</h3>
              <select
                className="status-filter"
                value={operatorFilter}
                onChange={(e) => setOperatorFilter(e.target.value)}
              >
                <option value="all">All operators</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="fleet-table-wrap">
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Bus</th>
                    <th>Operator</th>
                    <th>Status</th>
                    <th>Routes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuses.map((bus) => (
                    <tr
                      key={bus.id}
                      className={selectedBusId === bus.id ? "row-selected" : ""}
                      onClick={() => handleSelectBus(bus)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectBus(bus);
                        }
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="radio"
                          name="selectedBus"
                          checked={selectedBusId === bus.id}
                          onChange={() => handleSelectBus(bus)}
                          aria-label={`Select bus ${bus.name}`}
                        />
                      </td>
                      <td>{bus.name}</td>
                      <td>
                        <span className={`operator-tag ${bus.operator ?? ""}`}>
                          {operatorName(operators, bus.operator)}
                        </span>
                      </td>
                      <td>
                        <span className={`bus-status-pill ${bus.status ?? "active"}`}>
                          {statusLabel(bus.status)}
                        </span>
                      </td>
                      <td>{bus.routeAssignmentsCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBuses.length === 0 && (
                <p className="status">No buses yet. Click Add new bus to create one and choose its operator.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
