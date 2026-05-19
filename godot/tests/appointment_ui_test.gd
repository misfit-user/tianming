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

	var offices: Array = _array(game_state.get("court_offices"))
	var characters: Array = _array(game_state.get("characters"))
	if offices.is_empty() or characters.is_empty():
		_fail("Appointment UI has no offices or candidates to operate on")
		return

	var candidate: Dictionary = _first_unassigned_character(characters, _dict(game_state.get("office_assignments")))
	if candidate.is_empty():
		_fail("No available appointment candidate")
		return
	var office: Dictionary = _dict(offices[0])
	var office_id: String = str(office.get("id", ""))
	var action_points_before: int = int(game_state.get("action_points"))

	panel.emit_signal("appointment_requested", str(candidate.get("id", "")), office_id)
	await get_tree().process_frame

	if int(game_state.get("action_points")) != action_points_before - 1:
		_fail("Appointment UI request did not spend one action point")
		return
	var assignments: Dictionary = _dict(game_state.get("office_assignments"))
	if str(assignments.get(office_id, "")) != str(candidate.get("id", "")):
		_fail("Appointment UI request did not update office assignment")
		return

	print("[TianmingGodotTest] appointment UI scene test passed")
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

func _first_unassigned_character(characters: Array, assignments: Dictionary) -> Dictionary:
	var assigned: Dictionary = {}
	for raw_id in assignments.values():
		assigned[str(raw_id)] = true
	for raw in characters:
		var character: Dictionary = _dict(raw)
		var id: String = str(character.get("id", ""))
		if not id.is_empty() and not assigned.has(id):
			return character
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] appointment UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] appointment UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
