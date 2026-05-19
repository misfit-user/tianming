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
	var participant_ids: Array = _prepare_strong_participants(game_state)
	if participant_ids.size() < 3:
		_fail("Not enough participants for court meeting")
		return
	var action_points_before: int = int(game_state.get("action_points"))

	panel.emit_signal("court_meeting_requested", "finance_council", participant_ids)
	await get_tree().process_frame

	if int(game_state.get("action_points")) != action_points_before - 1:
		_fail("Court meeting UI request did not spend one action point")
		return
	if _array(game_state.get("court_meeting_history")).is_empty():
		_fail("Court meeting UI request did not record meeting history")
		return

	print("[TianmingGodotTest] court meeting UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _prepare_strong_participants(state: RefCounted) -> Array:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	var ids: Array = []
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		character["intelligence"] = 90
		character["administration"] = 92
		character["management"] = 88
		character["loyalty"] = 80
		rows[i] = character
		ids.append(id)
		if ids.size() >= 3:
			break
	state.set("characters", rows)
	return ids

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court meeting UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
