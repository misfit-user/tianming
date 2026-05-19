extends Node

const AudiencePanelScript := preload("res://scripts/audience_panel.gd")
const StatecraftPanelScript := preload("res://scripts/statecraft_panel.gd")

func _ready() -> void:
	if not await _verify_audience_character_title():
		return
	if not await _verify_statecraft_variable_description():
		return

	print("[TianmingGodotTest] compact list long-text scene test passed")
	_finish(0)

func _verify_audience_character_title() -> bool:
	var panel: Control = AudiencePanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var tail: String = "Audience title tail marker"
	var title: String = _long_text("Audience Official Title", tail, 8)
	panel.call("set_data", [
		{
			"id": "long_title_character",
			"name": "Long Title Character",
			"official_title": title,
		}
	], [
		{
			"id": "topic",
			"name": "Topic",
			"domain": "Court",
			"desc": "Topic description",
		}
	], [], 3)
	await get_tree().process_frame

	var character_select: OptionButton = panel.get("character_select") as OptionButton
	if character_select == null or character_select.item_count <= 0:
		_fail("Audience panel did not expose character selector item")
		return false
	if not character_select.get_item_text(0).contains(tail):
		_fail("Audience character selector truncated official title tail")
		return false
	return true

func _verify_statecraft_variable_description() -> bool:
	var panel: Control = StatecraftPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var tail: String = "Statecraft description tail marker"
	var description: String = _long_text("Statecraft variable description", tail, 10)
	panel.call("set_data", [
		{
			"name": "Long Description Variable",
			"value": "10",
			"category": "test",
			"status": "stable",
			"desc": description,
		}
	], [], [], 3)
	await get_tree().process_frame

	var variables_box: VBoxContainer = panel.get("variables_box") as VBoxContainer
	if variables_box == null or variables_box.get_child_count() <= 0:
		_fail("Statecraft panel did not expose variable list button")
		return false
	var button: Button = variables_box.get_child(0) as Button
	if button == null:
		_fail("Statecraft variable list first child is not a button")
		return false
	if not button.text.contains(tail):
		_fail("Statecraft variable list truncated description tail")
		return false
	return true

func _long_text(prefix: String, tail: String, repeat_count: int) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for i in range(repeat_count):
		parts.append("%s segment %02d" % [prefix, i + 1])
	parts.append(tail)
	return " ".join(parts)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] compact list long-text scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] compact list long-text scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
