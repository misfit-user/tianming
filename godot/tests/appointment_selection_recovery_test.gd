extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/appointment_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the appointment panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var removed_office_id: String = str(panel.get("selected_office_id"))
	if removed_office_id.is_empty():
		_fail("Appointment panel did not select an initial office")
		return

	var offices: Array = _array(game_state.get("court_offices")).duplicate(true)
	if offices.size() < 2:
		_fail("Appointment selection recovery test requires at least two offices")
		return
	var removed: bool = false
	for i in range(offices.size() - 1, -1, -1):
		var office: Dictionary = _dict(offices[i])
		if str(office.get("id", "")) == removed_office_id:
			offices.remove_at(i)
			removed = true
			break
	if not removed:
		_fail("Could not remove selected office from runtime state")
		return

	game_state.set("court_offices", offices)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var recovered_office_id: String = str(panel.get("selected_office_id"))
	if recovered_office_id.is_empty() or recovered_office_id == removed_office_id:
		_fail("Appointment panel kept a stale selected office after runtime removal")
		return
	if _office_by_id(offices, recovered_office_id).is_empty():
		_fail("Appointment panel recovered to an office that is not in runtime state")
		return

	print("[TianmingGodotTest] appointment selection recovery scene test passed")
	_finish(0)

func _office_by_id(offices: Array, office_id: String) -> Dictionary:
	for raw in offices:
		var office: Dictionary = _dict(raw)
		if str(office.get("id", "")) == office_id:
			return office
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
	print("[TianmingGodotTest] appointment selection recovery scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] appointment selection recovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
