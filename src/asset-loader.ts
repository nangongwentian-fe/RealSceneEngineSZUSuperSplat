import { AppBase, Asset, GSplatData, GSplatResource } from 'playcanvas';

import { Events } from './events';
import { Splat } from './splat';

interface ModelLoadRequest {
    filename?: string;
    url?: string;
    contents?: File;
    animationFrame?: boolean;                   // animations disable morton re-ordering at load time for faster loading
    mapUrl?: (name: string) => string;          // function to map texture names to URLs
}

// ideally this function would stream data directly into GSplatData buffers.
// unfortunately the .splat file format has no header specifying total number
// of splats so filesize must be known in order to allocate the correct amount
// of memory.
const deserializeFromSSplat = (data: ArrayBufferLike) => {
    const totalSplats = data.byteLength / 32;
    const dataView = new DataView(data);

    const storage_x = new Float32Array(totalSplats);
    const storage_y = new Float32Array(totalSplats);
    const storage_z = new Float32Array(totalSplats);
    const storage_opacity = new Float32Array(totalSplats);
    const storage_rot_0 = new Float32Array(totalSplats);
    const storage_rot_1 = new Float32Array(totalSplats);
    const storage_rot_2 = new Float32Array(totalSplats);
    const storage_rot_3 = new Float32Array(totalSplats);
    const storage_f_dc_0 = new Float32Array(totalSplats);
    const storage_f_dc_1 = new Float32Array(totalSplats);
    const storage_f_dc_2 = new Float32Array(totalSplats);
    const storage_scale_0 = new Float32Array(totalSplats);
    const storage_scale_1 = new Float32Array(totalSplats);
    const storage_scale_2 = new Float32Array(totalSplats);
    const storage_state = new Uint8Array(totalSplats);


    const SH_C0 = 0.28209479177387814;
    let off;

    for (let i = 0; i < totalSplats; i++) {
        off = i * 32;
        storage_x[i] = dataView.getFloat32(off + 0, true);
        storage_y[i] = dataView.getFloat32(off + 4, true);
        storage_z[i] = dataView.getFloat32(off + 8, true);

        storage_scale_0[i] = Math.log(dataView.getFloat32(off + 12, true));
        storage_scale_1[i] = Math.log(dataView.getFloat32(off + 16, true));
        storage_scale_2[i] = Math.log(dataView.getFloat32(off + 20, true));

        storage_f_dc_0[i] = (dataView.getUint8(off + 24) / 255 - 0.5) / SH_C0;
        storage_f_dc_1[i] = (dataView.getUint8(off + 25) / 255 - 0.5) / SH_C0;
        storage_f_dc_2[i] = (dataView.getUint8(off + 26) / 255 - 0.5) / SH_C0;

        storage_opacity[i] = -Math.log(255 / dataView.getUint8(off + 27) - 1);

        storage_rot_0[i] = (dataView.getUint8(off + 28) - 128) / 128;
        storage_rot_1[i] = (dataView.getUint8(off + 29) - 128) / 128;
        storage_rot_2[i] = (dataView.getUint8(off + 30) - 128) / 128;
        storage_rot_3[i] = (dataView.getUint8(off + 31) - 128) / 128;
    }

    return new GSplatData([{
        name: 'vertex',
        count: totalSplats,
        properties: [
            { type: 'float', name: 'x', storage: storage_x, byteSize: 4 },
            { type: 'float', name: 'y', storage: storage_y, byteSize: 4 },
            { type: 'float', name: 'z', storage: storage_z, byteSize: 4 },
            { type: 'float', name: 'opacity', storage: storage_opacity, byteSize: 4 },
            { type: 'float', name: 'rot_0', storage: storage_rot_0, byteSize: 4 },
            { type: 'float', name: 'rot_1', storage: storage_rot_1, byteSize: 4 },
            { type: 'float', name: 'rot_2', storage: storage_rot_2, byteSize: 4 },
            { type: 'float', name: 'rot_3', storage: storage_rot_3, byteSize: 4 },
            { type: 'float', name: 'f_dc_0', storage: storage_f_dc_0, byteSize: 4 },
            { type: 'float', name: 'f_dc_1', storage: storage_f_dc_1, byteSize: 4 },
            { type: 'float', name: 'f_dc_2', storage: storage_f_dc_2, byteSize: 4 },
            { type: 'float', name: 'scale_0', storage: storage_scale_0, byteSize: 4 },
            { type: 'float', name: 'scale_1', storage: storage_scale_1, byteSize: 4 },
            { type: 'float', name: 'scale_2', storage: storage_scale_2, byteSize: 4 },
            { type: 'float', name: 'state', storage: storage_state, byteSize: 4 }
        ]
    }]);
};

// handles loading gltf container assets
class AssetLoader {
    app: AppBase;
    events: Events;
    defaultAnisotropy: number;
    loadAllData = true;

    constructor(app: AppBase, events: Events, defaultAnisotropy?: number) {
        this.app = app;
        this.events = events;
        this.defaultAnisotropy = defaultAnisotropy || 1;
    }

    loadPly(loadRequest: ModelLoadRequest) {
        // For remote URLs, use progress-aware loading
        if (loadRequest.url && !loadRequest.contents) {
            return this.loadPlyWithProgress(loadRequest);
        }

        if (!loadRequest.animationFrame) {
            this.events.fire('startSpinner');
        }

        const contents = loadRequest.contents && (loadRequest.contents instanceof Response ? loadRequest.contents : new Response(loadRequest.contents));

        const file = {
            url: loadRequest.url ?? loadRequest.filename,
            filename: loadRequest.filename,
            contents
        };

        const data = {
            // decompress data on load
            decompress: true,
            // disable morton re-ordering when loading animation frames
            reorder: !(loadRequest.animationFrame ?? false),
            mapUrl: loadRequest.mapUrl
        };

        const options = {
            mapUrl: loadRequest.mapUrl
        };

        return new Promise<Splat>((resolve, reject) => {
            const asset = new Asset(
                loadRequest.filename || loadRequest.url,
                'gsplat',
                // @ts-ignore
                file,
                data,
                options
            );

            asset.on('load:data', (data: GSplatData) => {
                // support loading 2d splats by adding scale_2 property with almost 0 scale
                if (data instanceof GSplatData && data.getProp('scale_0') && data.getProp('scale_1') && !data.getProp('scale_2')) {
                    const scale2 = new Float32Array(data.numSplats).fill(Math.log(1e-6));
                    data.addProp('scale_2', scale2);

                    // place the new scale_2 property just after scale_1
                    const props = data.getElement('vertex').properties;
                    props.splice(props.findIndex((prop: any) => prop.name === 'scale_1') + 1, 0, props.splice(props.length - 1, 1)[0]);
                }
            });

            asset.on('load', () => {
                // check the PLY contains minimal set of we expect
                const required = [
                    'x', 'y', 'z',
                    'scale_0', 'scale_1', 'scale_2',
                    'rot_0', 'rot_1', 'rot_2', 'rot_3',
                    'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity'
                ];
                const splatData = (asset.resource as GSplatResource).gsplatData as GSplatData;
                const missing = required.filter(x => !splatData.getProp(x));
                if (missing.length > 0) {
                    reject(new Error(`This file does not contain gaussian splatting data. The following properties are missing: ${missing.join(', ')}`));
                } else {
                    resolve(new Splat(asset));
                }
            });

            asset.on('error', (err: string) => {
                reject(err);
            });

            this.app.assets.add(asset);
            this.app.assets.load(asset);
        }).finally(() => {
            if (!loadRequest.animationFrame) {
                this.events.fire('stopSpinner');
            }
        });
    }

    // 带进度监控的PLY加载方法
    async loadPlyWithProgress(loadRequest: ModelLoadRequest): Promise<Splat> {
        const filename = loadRequest.filename || loadRequest.url?.split('/').pop() || 'unknown.ply';
        
        try {
            // 开始进度显示
            this.events.fire('progressStart', `Loading ${filename}`);
            this.events.fire('progressUpdate', {
                text: 'Connecting to server...',
                progress: 0
            });

            // 获取响应
            const response = await fetch(loadRequest.url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch ${loadRequest.url}: ${response.status} ${response.statusText}`);
            }

            // 获取文件大小
            const contentLength = response.headers.get('Content-Length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

            if (!response.body) {
                throw new Error('ReadableStream not supported');
            }

            this.events.fire('progressUpdate', {
                text: `Downloading ${filename}...`,
                progress: 0
            });

            // 使用ReadableStream监控下载进度
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                receivedBytes += value.length;

                // 更新下载进度
                if (totalBytes > 0) {
                    const progress = Math.min(95, (receivedBytes / totalBytes) * 100);
                    this.events.fire('progressUpdate', {
                        text: `Downloading ${filename}... (${Math.round(receivedBytes / 1024 / 1024 * 100) / 100}MB / ${Math.round(totalBytes / 1024 / 1024 * 100) / 100}MB)`,
                        progress
                    });
                } else {
                    // 如果无法获取总大小，显示已下载的字节数
                    this.events.fire('progressUpdate', {
                        text: `Downloading ${filename}... (${Math.round(receivedBytes / 1024 / 1024 * 100) / 100}MB)`,
                        progress: Math.min(90, receivedBytes / (1024 * 1024) * 10) // 估算进度
                    });
                }
            }

            // 合并所有chunks
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combinedArray = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                combinedArray.set(chunk, offset);
                offset += chunk.length;
            }

            this.events.fire('progressUpdate', {
                text: 'Processing file...',
                progress: 96
            });

            // 创建Blob并转换为File对象
            const blob = new Blob([combinedArray], { type: 'application/ply' });
            const file = new File([blob], filename, { type: 'application/ply' });

            // 使用现有的loadPly方法处理文件
            const modifiedRequest: ModelLoadRequest = {
                ...loadRequest,
                contents: file,
                url: undefined // 避免递归调用
            };

            this.events.fire('progressUpdate', {
                text: 'Loading 3D data...',
                progress: 98
            });

            const result = await this.loadPly(modifiedRequest);

            this.events.fire('progressUpdate', {
                text: 'Complete!',
                progress: 100
            });

            return result;

        } catch (error) {
            console.error('Error loading PLY with progress:', error);
            throw error;
        } finally {
            // 延迟关闭进度条，让用户看到100%
            setTimeout(() => {
                this.events.fire('progressEnd');
            }, 500);
        }
    }

    async loadSplat(loadRequest: ModelLoadRequest) {
        // For remote URLs, use progress-aware loading
        if (loadRequest.url && !loadRequest.contents) {
            return this.loadSplatWithProgress(loadRequest);
        }

        this.events.fire('startSpinner');

        try {
            const contents = loadRequest.contents && (loadRequest.contents instanceof Response ? loadRequest.contents : new Response(loadRequest.contents));
            const response = await (contents ?? fetch(loadRequest.url || loadRequest.filename)) as Response;

            if (!response || !response.ok || !response.body) {
                throw new Error('Failed to fetch splat data');
            }

            const arrayBuffer = await response.arrayBuffer();

            const gsplatData = deserializeFromSSplat(arrayBuffer);

            const asset = new Asset(loadRequest.filename || loadRequest.url, 'gsplat', {
                url: loadRequest.url,
                filename: loadRequest.filename
            });
            this.app.assets.add(asset);
            asset.resource = new GSplatResource(this.app.graphicsDevice, gsplatData);

            return new Splat(asset);
        } finally {
            this.events.fire('stopSpinner');
        }
    }

    // 带进度监控的SPLAT加载方法
    async loadSplatWithProgress(loadRequest: ModelLoadRequest): Promise<Splat> {
        const filename = loadRequest.filename || loadRequest.url?.split('/').pop() || 'unknown.splat';
        
        try {
            // 开始进度显示
            this.events.fire('progressStart', `Loading ${filename}`);
            this.events.fire('progressUpdate', {
                text: 'Connecting to server...',
                progress: 0
            });

            // 获取响应
            const response = await fetch(loadRequest.url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch ${loadRequest.url}: ${response.status} ${response.statusText}`);
            }

            // 获取文件大小
            const contentLength = response.headers.get('Content-Length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

            if (!response.body) {
                throw new Error('ReadableStream not supported');
            }

            this.events.fire('progressUpdate', {
                text: `Downloading ${filename}...`,
                progress: 0
            });

            // 使用ReadableStream监控下载进度
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                receivedBytes += value.length;

                // 更新下载进度
                if (totalBytes > 0) {
                    const progress = Math.min(95, (receivedBytes / totalBytes) * 100);
                    this.events.fire('progressUpdate', {
                        text: `Downloading ${filename}... (${Math.round(receivedBytes / 1024 / 1024 * 100) / 100}MB / ${Math.round(totalBytes / 1024 / 1024 * 100) / 100}MB)`,
                        progress
                    });
                } else {
                    // 如果无法获取总大小，显示已下载的字节数
                    this.events.fire('progressUpdate', {
                        text: `Downloading ${filename}... (${Math.round(receivedBytes / 1024 / 1024 * 100) / 100}MB)`,
                        progress: Math.min(90, receivedBytes / (1024 * 1024) * 10) // 估算进度
                    });
                }
            }

            // 合并所有chunks为ArrayBuffer
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combinedArray = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                combinedArray.set(chunk, offset);
                offset += chunk.length;
            }

            this.events.fire('progressUpdate', {
                text: 'Processing file...',
                progress: 96
            });

            // 处理SPLAT数据
            const gsplatData = deserializeFromSSplat(combinedArray.buffer);

            this.events.fire('progressUpdate', {
                text: 'Loading 3D data...',
                progress: 98
            });

            const asset = new Asset(filename, 'gsplat', {
                url: loadRequest.url,
                filename: filename
            });
            this.app.assets.add(asset);
            asset.resource = new GSplatResource(this.app.graphicsDevice, gsplatData);

            this.events.fire('progressUpdate', {
                text: 'Complete!',
                progress: 100
            });

            return new Splat(asset);

        } catch (error) {
            console.error('Error loading SPLAT with progress:', error);
            throw error;
        } finally {
            // 延迟关闭进度条，让用户看到100%
            setTimeout(() => {
                this.events.fire('progressEnd');
            }, 500);
        }
    }

    loadModel(loadRequest: ModelLoadRequest) {
        const filename = (loadRequest.filename || loadRequest.url).toLowerCase();
        if (filename.endsWith('.ply') || filename === 'meta.json') {
            return this.loadPly(loadRequest);
        } else if (filename.endsWith('.splat')) {
            return this.loadSplat(loadRequest);
        }
    }
}

export { AssetLoader };
