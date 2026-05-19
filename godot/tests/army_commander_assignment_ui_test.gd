extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/army_roster_panel.gd")
	if panel == null:
		_fail("Main scene does not expose army roster panel")
		return
	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var army: Dictionary = _army_by_name(_array(game_state.get("armies")), "关宁军主力")
	var candidate: Dictionary = _character_by_name(_array(game_state.get("characters")), "孙承宗")
	if army.is_empty() or candidate.is_empty():
		_fail("Fixture army or commander candidate is missing")
		return

	panel.emit_signal("army_commander_requested", str(army.get("id", "")), str(candidate.get("id", "")))
	await get_tree().process_frame

	var updated: Dictionary = _army_by_id(_array(game_state.get("armies")), str(army.get("id", "")))
	if str(updated.get("commander", "")) != "孙承宗":
		_fail("Army commander UI request did not update runtime commander")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("统帅更易") or not text.contains("孙承宗"):
		_fail("Army roster panel did not refresh command history after assignment")
		return

	print("[TianmingGodotTest] army commander assignment UI scene test passed")
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

func _army_by_name(rows: Array, army_name: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("name", "")) == army_name:
			return row
	return {}

func _army_by_id(rows: Array, army_id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == army_id:
			return row
	return {}

func _character_by_name(rows: Array, character_name: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("name", "")) == character_name:
			return row
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army commander assignment UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
