package com.tianming.plugins.fileexport;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

/** Android Storage Access Framework export; no broad storage permission required. */
@CapacitorPlugin(name = "TianmingFileExport")
public class TianmingFileExportPlugin extends Plugin {
    private final AtomicBoolean exporting = new AtomicBoolean(false);
    private volatile File pendingFile;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("缺少导出内容", "INVALID_DATA");
            return;
        }
        if (!exporting.compareAndSet(false, true)) {
            call.reject("请先完成或取消当前导出", "EXPORT_BUSY");
            return;
        }
        String fileName = call.getString("fileName", "天命导出.json")
            .replaceAll("[\\\\/\\x00-\\x1f]", "_").trim();
        if (fileName.isEmpty()) fileName = "天命导出.json";
        call.getData().put("fileName", fileName);
        // Capacitor persists call options while the picker is open. A large save
        // must never enter an Android instance-state Bundle (Binder size limit).
        call.getData().remove("data");
        execute(() -> prepareExport(call, data));
    }

    private void prepareExport(PluginCall call, String data) {
        try {
            pendingFile = File.createTempFile("tianming-export-", ".json", getContext().getCacheDir());
            try (Writer writer = new OutputStreamWriter(new FileOutputStream(pendingFile), StandardCharsets.UTF_8)) {
                writer.write(data);
            }
            getActivity().runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(call.getString("mimeType", "application/json"));
                    intent.putExtra(Intent.EXTRA_TITLE, call.getString("fileName"));
                    startActivityForResult(call, intent, "documentCreated");
                } catch (Exception error) {
                    fail(call, "无法打开系统保存窗口", "PICKER_UNAVAILABLE", error);
                }
            });
        } catch (Exception error) {
            fail(call, "无法准备导出文件", "EXPORT_PREPARE_FAILED", error);
        }
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) {
            cleanup();
            return;
        }
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            cleanup();
            JSObject response = new JSObject();
            response.put("saved", false);
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Intent intent = result.getData();
        Uri uri = intent == null ? null : intent.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            fail(call, "系统未返回保存位置", "INVALID_DESTINATION", null);
            return;
        }
        // Activity results arrive on the UI thread. Stream the save on
        // Capacitor's worker thread, including provider I/O and display-name lookup.
        execute(() -> writeDocument(call, uri));
    }

    private void writeDocument(PluginCall call, Uri uri) {
        File source = pendingFile;
        if (source == null || !source.isFile()) {
            fail(call, "导出内容已失效，请重新导出", "EXPORT_EXPIRED", null);
            return;
        }
        try {
            try (FileInputStream input = new FileInputStream(source);
                 OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("Document provider returned no output stream");
                byte[] buffer = new byte[16384];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                output.flush();
            }
            // Only report success after the provider stream has closed successfully.
            String fileName = call.getString("fileName");
            try (Cursor cursor = getContext().getContentResolver().query(
                    uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (index >= 0 && !cursor.isNull(index)) fileName = cursor.getString(index);
                }
            } catch (Exception ignored) {
                // A provider may allow writing but not querying metadata.
            }
            cleanup();
            JSObject response = new JSObject();
            response.put("saved", true);
            response.put("cancelled", false);
            response.put("fileName", fileName);
            response.put("uri", uri.toString());
            call.resolve(response);
        } catch (Exception error) {
            fail(call, "导出失败，请检查所选位置的可用空间或更换文件夹", "EXPORT_WRITE_FAILED", error);
        }
    }

    private void fail(PluginCall call, String message, String code, Exception error) {
        cleanup();
        call.reject(message, code, error);
    }

    private void cleanup() {
        File source = pendingFile;
        pendingFile = null;
        if (source != null) source.delete();
        exporting.set(false);
    }

    @Override
    protected Bundle saveInstanceState() {
        File source = pendingFile;
        if (source == null) return null;
        Bundle state = new Bundle();
        state.putString("pendingFile", source.getName());
        return state;
    }

    @Override
    protected void restoreState(Bundle state) {
        String fileName = state.getString("pendingFile");
        if (fileName != null && fileName.matches("tianming-export-[a-zA-Z0-9.-]+\\.json")) {
            pendingFile = new File(getContext().getCacheDir(), fileName);
            exporting.set(true);
        }
    }
}
