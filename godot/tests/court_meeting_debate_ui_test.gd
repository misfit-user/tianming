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

	var participant_ids: Array = _prepare_mixed_participants(game_state)
	panel.emit_signal("court_meeting_requested", "finance_council", participant_ids)
	await get_tree().process_frame

	var debate_entries: Array = _array(panel.get("current_debate_entries"))
	if debate_entries.is_empty():
		_fail("Court meeting panel did not keep latest debate entries")
		return

	var history_label: Label = panel.get("history_label") as Label
	if history_label == null:
		_fail("Court meeting panel does not expose history label")
		return
	if not history_label.text.contains("support"):
		_fail("Court meeting panel history did not display support stance")
		return
	if not (history_label.text.contains("oppose") or history_label.text.contains("caution")):
		_fail("Court meeting panel history did not display dissenting stance")
		return

	print("[TianmingGodotTest] court meeting debate UI scene test passed")
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

func _prepare_mixed_participants(state: RefCounted) -> Array:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	var ids: Array = []
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		character["intelligence"] = 92
		character["administration"] = 94
		character["management"] = 90
		character["military"] = 70
		character["valor"] = 68
		character["party"] = ["qingliu", "neutral", "yandang", "bureaucrat"][ids.size()]
		character["faction"] = ["court", "court", "inner_court", "court"][ids.size()]
		character["loyalty"] = [86, 58, 42, 78][ids.size()]
		character["ambition"] = [20, 68, 92, 35][ids.size()]
		character.erase("relationships")
		character.erase("relations")
		character.erase("relationship")
		rows[i] = character
		ids.append(id)
		if ids.size() >= 4:
			break
	state.set("characters", rows)
	state.set("character_relations", [])
	return ids

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court meeting debate UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting debate UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
