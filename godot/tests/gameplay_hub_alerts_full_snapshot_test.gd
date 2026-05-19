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

	game_state.set("event_queue", _named_rows(5, "event-sentinel"))
	game_state.set("pending_court_recommendations", _named_rows(5, "recommendation-sentinel"))
	game_state.set("communication_inbox", _communication_rows(5))
	game_state.set("last_turn_report", {
		"military_alerts": _string_rows(5, "military-sentinel"),
		"uprisings": _uprising_rows(4),
		"faction_ai_actions": _faction_action_rows(5),
	})

	var snapshot: Dictionary = game_state.call("gameplay_hub_snapshot", false)
	var alerts_text: String = "\n".join(_string_array(snapshot.get("urgent_alerts", [])))
	for needle in [
		"event-sentinel-4",
		"recommendation-sentinel-4",
		"communication-sentinel-4",
		"military-sentinel-4",
		"uprising-sentinel-3",
		"raid-sentinel-4",
	]:
		if not alerts_text.contains(needle):
			_fail("Gameplay hub snapshot omitted later alert: %s" % needle)
			return

	print("[TianmingGodotTest] gameplay hub alerts full-snapshot scene test passed")
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
			"id": "communication-sentinel-%d" % i,
			"title": "communication-sentinel-%d" % i,
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
		rows.append({"name": "uprising-sentinel-%d" % i, "region": "region-%d" % i})
	return rows

func _faction_action_rows(count: int) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({"kind": "raid", "target_region": "raid-sentinel-%d" % i})
	return rows

func _string_array(value: Variant) -> PackedStringArray:
	var rows: PackedStringArray = PackedStringArray()
	if typeof(value) != TYPE_ARRAY:
		return rows
	for raw in value:
		rows.append(str(raw))
	return rows

func _fail(message: String) -> void:
	print("[TianmingGodotTest] gameplay hub alerts full-snapshot scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] gameplay hub alerts full-snapshot scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
