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

	var army: Dictionary = _army_with_arrears(_array(game_state.get("armies")))
	if army.is_empty():
		_fail("Fixture army with arrears is missing")
		return
	var army_id: String = str(army.get("id", ""))
	var arrears_before: int = int(_num(army.get("pay_arrears_months", 0)))

	panel.emit_signal("army_action_requested", army_id, "pay_army_arrears")
	await get_tree().process_frame

	var updated: Dictionary = _army_by_id(_array(game_state.get("armies")), army_id)
	if int(_num(updated.get("pay_arrears_months", 0))) >= arrears_before:
		_fail("Army action UI request did not update runtime arrears")
		return
	var text: String = str(panel.call("visible_text"))
	var history: Array = _array(game_state.get("army_action_history"))
	if history.is_empty():
		_fail("Army action UI request did not record history")
		return
	var record: Dictionary = _dict(history[history.size() - 1])
	if not text.contains(str(record.get("name", ""))) or not text.contains(str(updated.get("name", ""))):
		_fail("Army roster panel did not refresh action history after army action")
		return

	print("[TianmingGodotTest] army action UI scene test passed")
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

func _army_with_arrears(rows: Array) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")).is_empty():
			continue
		if _num(row.get("pay_arrears_months", 0)) > 0.0 and _num(row.get("mutiny_risk", 0)) > 0.0:
			return row
	return {}

func _army_by_id(rows: Array, army_id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == army_id:
			return row
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army action UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
