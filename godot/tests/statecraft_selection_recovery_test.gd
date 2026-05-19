extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/statecraft_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the statecraft panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var removed_variable_name: String = str(panel.get("selected_variable_name"))
	if removed_variable_name.is_empty():
		_fail("Statecraft panel did not select an initial variable")
		return

	var variables: Array = _array(game_state.get("variables")).duplicate(true)
	if variables.size() < 2:
		_fail("Statecraft selection recovery test requires at least two variables")
		return
	var removed: bool = false
	for i in range(variables.size() - 1, -1, -1):
		var variable: Dictionary = _dict(variables[i])
		if str(variable.get("name", "")) == removed_variable_name:
			variables.remove_at(i)
			removed = true
			break
	if not removed:
		_fail("Could not remove selected variable from runtime state")
		return

	game_state.set("variables", variables)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var recovered_variable_name: String = str(panel.get("selected_variable_name"))
	if recovered_variable_name.is_empty() or recovered_variable_name == removed_variable_name:
		_fail("Statecraft panel kept a stale selected variable after runtime removal")
		return
	if _variable_by_name(variables, recovered_variable_name).is_empty():
		_fail("Statecraft panel recovered to a variable that is not in runtime state")
		return
	if not str(panel.call("visible_text")).contains(recovered_variable_name):
		_fail("Statecraft panel did not display the recovered runtime variable")
		return

	print("[TianmingGodotTest] statecraft selection recovery scene test passed")
	_finish(0)

func _variable_by_name(variables: Array, variable_name: String) -> Dictionary:
	for raw in variables:
		var variable: Dictionary = _dict(raw)
		if str(variable.get("name", "")) == variable_name:
			return variable
	return {}

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
	print("[TianmingGodotTest] statecraft selection recovery scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] statecraft selection recovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
