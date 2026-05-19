extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/court_meeting_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the court meeting panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	_inject_frontier_pressure(game_state)
	var participant_ids: Array = _prepare_frontier_participants(game_state)
	panel.emit_signal("court_meeting_requested", "frontier_council", participant_ids)
	await get_tree().process_frame

	var history_label: Label = panel.get("history_label") as Label
	if history_label == null:
		_fail("Court meeting panel does not expose history label")
		return
	if not history_label.text.contains("Agenda"):
		_fail("Court meeting panel did not display agenda pressure")
		return
	if not history_label.text.contains("Test Frontier"):
		_fail("Court meeting panel did not display the pressured region name")
		return

	print("[TianmingGodotTest] court meeting agenda pressure UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _inject_frontier_pressure(state: RefCounted) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	rows.append({
		"id": "test_frontier",
		"name": "Test Frontier",
		"owner": "Ming",
		"controller": "Ming",
		"terrain": "frontier",
		"prosperity": 42,
		"mood": 38,
		"unrest": 64,
		"army_pressure": 100,
		"tax_pressure": 45,
		"troops": 12000
	})
	state.set("map_regions", rows)

func _prepare_frontier_participants(state: RefCounted) -> Array:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	var ids: Array = []
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		character["military"] = 92
		character["valor"] = 88
		character["intelligence"] = 84
		character["loyalty"] = 78
		rows[i] = character
		ids.append(id)
		if ids.size() >= 3:
			break
	state.set("characters", rows)
	return ids

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court meeting agenda pressure UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting agenda pressure UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
