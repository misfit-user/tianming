extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	if not game_state.has_method("gameplay_hub_snapshot"):
		_fail("GameState does not expose gameplay_hub_snapshot")
		return

	game_state.set("event_queue", _named_rows(4, "state-event"))
	game_state.set("pending_court_recommendations", _named_rows(4, "state-recommendation"))
	game_state.set("communication_inbox", _communication_rows(4))
	game_state.set("action_history", _named_rows(4, "state-action-history"))
	game_state.set("issued_edicts", _named_rows(3, "state-edict-history"))
	game_state.set("diplomacy_history", _named_rows(3, "state-diplomacy-history"))
	game_state.set("last_turn_report", {
		"military_alerts": _string_rows(4, "state-military"),
		"uprisings": _uprising_rows(3),
		"faction_ai_actions": _faction_action_rows(4),
	})

	var snapshot: Dictionary = game_state.call("gameplay_hub_snapshot", true)
	if not bool(snapshot.get("has_quick_save", false)):
		_fail("GameState gameplay hub snapshot did not preserve quick-save status")
		return
	var alerts_text: String = "\n".join(_string_array(snapshot.get("urgent_alerts", [])))
	for needle in [
		"state-event-3",
		"state-recommendation-3",
		"state-communication-3",
		"state-military-3",
		"state-uprising-2",
		"state-raid-3",
	]:
		if not alerts_text.contains(needle):
			_fail("GameState gameplay hub snapshot omitted alert: %s" % needle)
			return

	var history_text: String = str(snapshot.get("history", ""))
	for needle in [
		"state-action-history-0",
		"state-edict-history-0",
		"state-diplomacy-history-0",
	]:
		if not history_text.contains(needle):
			_fail("GameState gameplay hub snapshot omitted history: %s" % needle)
			return
	if str(snapshot.get("date", "")).is_empty() or int(snapshot.get("action_points", -1)) < 0:
		_fail("GameState gameplay hub snapshot omitted playable turn state")
		return

	print("[TianmingGodotTest] gameplay hub snapshot state scene test passed")
	_finish(0)

func _named_rows(count: int, prefix: String) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({"id": "%s-%d" % [prefix, i], "name": "%s-%d" % [prefix, i]})
	return rows

func _communication_rows(count: int) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({
			"id": "state-communication-%d" % i,
			"title": "state-communication-%d" % i,
			"kind": "memorial",
			"priority": 1,
			"turn": i + 1,
		})
	return rows

func _string_rows(count: int, prefix: String) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append("%s-%d" % [prefix, i])
	return rows

func _uprising_rows(count: int) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({"name": "state-uprising-%d" % i, "region": "region-%d" % i})
	return rows

func _faction_action_rows(count: int) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({"kind": "raid", "target_region": "state-raid-%d" % i})
	return rows

func _string_array(value: Variant) -> PackedStringArray:
	var rows: PackedStringArray = PackedStringArray()
	if typeof(value) != TYPE_ARRAY:
		return rows
	for raw in value:
		rows.append(str(raw))
	return rows

func _fail(message: String) -> void:
	print("[TianmingGodotTest] gameplay hub snapshot state scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] gameplay hub snapshot state scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
