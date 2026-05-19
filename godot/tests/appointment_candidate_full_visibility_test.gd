extends Node

const AppointmentPanelScript := preload("res://scripts/appointment_panel.gd")

func _ready() -> void:
	var panel: Control = AppointmentPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var offices: Array = [{
		"id": "office_1",
		"name": "吏部尚书",
		"domain": "政务"
	}]
	var characters: Array = []
	for i in range(20):
		characters.append({
			"id": "candidate_%02d" % i,
			"name": "候选官员%02d" % i,
			"official_title": "待补",
			"loyalty": 50 + i,
			"administration": 40 + i,
			"military": 20,
			"intelligence": 45 + i,
			"management": 30 + i,
			"valor": 10
		})

	panel.call("set_data", offices, characters, {}, [], 3)
	await get_tree().process_frame

	var candidates_box: VBoxContainer = panel.get("candidates_box") as VBoxContainer
	if candidates_box == null:
		_fail("Appointment panel did not expose candidates_box")
		return
	if candidates_box.get_child_count() != characters.size():
		_fail("Appointment panel truncated candidates: got %d expected %d" % [
			candidates_box.get_child_count(),
			characters.size()
		])
		return

	print("[TianmingGodotTest] appointment candidate full visibility scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] appointment candidate full visibility scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] appointment candidate full visibility scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
