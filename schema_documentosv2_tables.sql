--
-- PostgreSQL database dump
--

\restrict MWPJzcQvDKgVf09oBE0AIVh9ZA3pDU1Jo05TCGLSdkNy39CNvlBLvXFQ7mmukPC

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: doc_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doc_versions (
    id_version bigint NOT NULL,
    id_documento bigint NOT NULL,
    numero_version integer NOT NULL,
    archivo_nombre text NOT NULL,
    archivo_path text NOT NULL,
    archivo_tipo character varying(100),
    archivo_tamano bigint,
    descripcion_cambio text,
    mensaje_auditoria text,
    fecha_subida timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    subido_por bigint,
    fecha_aprobacion timestamp with time zone NOT NULL,
    uuid_version uuid DEFAULT gen_random_uuid() NOT NULL,
    estado text DEFAULT 'INACTIVO'::text NOT NULL,
    estado_ia text DEFAULT 'PENDIENTE'::text NOT NULL,
    porcentaje_texto_ia numeric(5,2),
    mensaje_ia text,
    fecha_analisis_ia timestamp with time zone,
    eliminado_por bigint,
    fecha_eliminacion timestamp with time zone,
    motivo_eliminacion text,
    CONSTRAINT chk_numero_version CHECK ((numero_version > 0)),
    CONSTRAINT ck_doc_versions_estado CHECK ((estado = ANY (ARRAY['VIGENTE'::text, 'INACTIVO'::text, 'ELIMINADO'::text]))),
    CONSTRAINT ck_doc_versions_estado_ia CHECK ((estado_ia = ANY (ARRAY['PENDIENTE'::text, 'LEIDO'::text, 'OBSERVADO'::text, 'ERROR'::text])))
);


--
-- Name: doc_versions_id_version_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doc_versions_id_version_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doc_versions_id_version_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doc_versions_id_version_seq OWNED BY public.doc_versions.id_version;


--
-- Name: docs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs (
    id_documento bigint NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    fecha_aprobacion timestamp with time zone NOT NULL,
    id_version_vigente bigint,
    creado_por bigint,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_por bigint,
    fecha_actualizacion timestamp with time zone,
    eliminado_por bigint,
    fecha_eliminacion timestamp with time zone,
    motivo_eliminacion text,
    palabras_clave text DEFAULT ''::text NOT NULL,
    tiene_versionamiento boolean DEFAULT false NOT NULL,
    uuid_documento uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: docs_id_documento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.docs_id_documento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: docs_id_documento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.docs_id_documento_seq OWNED BY public.docs.id_documento;


--
-- Name: documento_acceso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documento_acceso (
    id_acceso bigint NOT NULL,
    id_documento bigint NOT NULL,
    id_perfil_externo bigint,
    id_grupo_externo bigint,
    id_tipo_periodo_externo bigint,
    activo boolean DEFAULT true NOT NULL,
    asignado_por bigint,
    fecha_asignacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: documento_acceso_id_acceso_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documento_acceso_id_acceso_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documento_acceso_id_acceso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documento_acceso_id_acceso_seq OWNED BY public.documento_acceso.id_acceso;


--
-- Name: documento_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documento_auditoria (
    id_auditoria bigint NOT NULL,
    id_documento bigint,
    id_version bigint,
    id_usuario_externo bigint,
    nombre_usuario text,
    accion character varying(50) NOT NULL,
    mensaje text NOT NULL,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    fecha_hora timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: documento_auditoria_id_auditoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documento_auditoria_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documento_auditoria_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documento_auditoria_id_auditoria_seq OWNED BY public.documento_auditoria.id_auditoria;


--
-- Name: documento_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documento_lectura (
    id_lectura bigint NOT NULL,
    id_documento bigint NOT NULL,
    id_version bigint,
    id_usuario_externo bigint,
    nombre_usuario text,
    accion character varying(30) NOT NULL,
    fecha_hora timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_documento_lectura_accion CHECK (((accion)::text = ANY ((ARRAY['LECTURA'::character varying, 'PREVISUALIZACION'::character varying, 'DESCARGA'::character varying])::text[])))
);


--
-- Name: documento_lectura_id_lectura_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documento_lectura_id_lectura_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documento_lectura_id_lectura_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documento_lectura_id_lectura_seq OWNED BY public.documento_lectura.id_lectura;


--
-- Name: doc_versions id_version; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_versions ALTER COLUMN id_version SET DEFAULT nextval('public.doc_versions_id_version_seq'::regclass);


--
-- Name: docs id_documento; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs ALTER COLUMN id_documento SET DEFAULT nextval('public.docs_id_documento_seq'::regclass);


--
-- Name: documento_acceso id_acceso; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_acceso ALTER COLUMN id_acceso SET DEFAULT nextval('public.documento_acceso_id_acceso_seq'::regclass);


--
-- Name: documento_auditoria id_auditoria; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('public.documento_auditoria_id_auditoria_seq'::regclass);


--
-- Name: documento_lectura id_lectura; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_lectura ALTER COLUMN id_lectura SET DEFAULT nextval('public.documento_lectura_id_lectura_seq'::regclass);


--
-- Name: doc_versions doc_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_versions
    ADD CONSTRAINT doc_versions_pkey PRIMARY KEY (id_version);


--
-- Name: docs docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_pkey PRIMARY KEY (id_documento);


--
-- Name: documento_acceso documento_acceso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_acceso
    ADD CONSTRAINT documento_acceso_pkey PRIMARY KEY (id_acceso);


--
-- Name: documento_auditoria documento_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_auditoria
    ADD CONSTRAINT documento_auditoria_pkey PRIMARY KEY (id_auditoria);


--
-- Name: documento_lectura documento_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_lectura
    ADD CONSTRAINT documento_lectura_pkey PRIMARY KEY (id_lectura);


--
-- Name: doc_versions uq_doc_version_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_versions
    ADD CONSTRAINT uq_doc_version_numero UNIQUE (id_documento, numero_version);


--
-- Name: documento_acceso uq_documento_acceso; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_acceso
    ADD CONSTRAINT uq_documento_acceso UNIQUE (id_documento, id_perfil_externo, id_grupo_externo, id_tipo_periodo_externo);


--
-- Name: idx_doc_versions_id_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_versions_id_documento ON public.doc_versions USING btree (id_documento);


--
-- Name: idx_docs_descripcion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_descripcion ON public.docs USING gin (to_tsvector('spanish'::regconfig, descripcion));


--
-- Name: idx_docs_titulo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_titulo ON public.docs USING gin (to_tsvector('spanish'::regconfig, titulo));


--
-- Name: idx_documento_acceso_id_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_acceso_id_documento ON public.documento_acceso USING btree (id_documento);


--
-- Name: idx_documento_acceso_segmento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_acceso_segmento ON public.documento_acceso USING btree (id_perfil_externo, id_grupo_externo, id_tipo_periodo_externo);


--
-- Name: idx_documento_auditoria_accion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_auditoria_accion ON public.documento_auditoria USING btree (accion);


--
-- Name: idx_documento_auditoria_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_auditoria_documento ON public.documento_auditoria USING btree (id_documento);


--
-- Name: idx_documento_auditoria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_auditoria_fecha ON public.documento_auditoria USING btree (fecha_hora);


--
-- Name: idx_documento_auditoria_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_auditoria_usuario ON public.documento_auditoria USING btree (id_usuario_externo);


--
-- Name: idx_documento_lectura_accion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_lectura_accion ON public.documento_lectura USING btree (accion);


--
-- Name: idx_documento_lectura_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documento_lectura_documento ON public.documento_lectura USING btree (id_documento);


--
-- Name: ix_doc_versions_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_doc_versions_estado ON public.doc_versions USING btree (estado);


--
-- Name: ix_doc_versions_estado_ia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_doc_versions_estado_ia ON public.doc_versions USING btree (estado_ia);


--
-- Name: uq_doc_versions_uuid_version; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_doc_versions_uuid_version ON public.doc_versions USING btree (uuid_version);


--
-- Name: uq_docs_uuid_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_docs_uuid_documento ON public.docs USING btree (uuid_documento);


--
-- Name: doc_versions fk_doc_versions_docs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_versions
    ADD CONSTRAINT fk_doc_versions_docs FOREIGN KEY (id_documento) REFERENCES public.docs(id_documento) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: docs fk_docs_version_vigente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT fk_docs_version_vigente FOREIGN KEY (id_version_vigente) REFERENCES public.doc_versions(id_version) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documento_acceso fk_documento_acceso_docs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_acceso
    ADD CONSTRAINT fk_documento_acceso_docs FOREIGN KEY (id_documento) REFERENCES public.docs(id_documento) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documento_auditoria fk_documento_auditoria_docs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_auditoria
    ADD CONSTRAINT fk_documento_auditoria_docs FOREIGN KEY (id_documento) REFERENCES public.docs(id_documento) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documento_auditoria fk_documento_auditoria_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_auditoria
    ADD CONSTRAINT fk_documento_auditoria_version FOREIGN KEY (id_version) REFERENCES public.doc_versions(id_version) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documento_lectura fk_documento_lectura_docs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_lectura
    ADD CONSTRAINT fk_documento_lectura_docs FOREIGN KEY (id_documento) REFERENCES public.docs(id_documento) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documento_lectura fk_documento_lectura_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documento_lectura
    ADD CONSTRAINT fk_documento_lectura_version FOREIGN KEY (id_version) REFERENCES public.doc_versions(id_version) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict MWPJzcQvDKgVf09oBE0AIVh9ZA3pDU1Jo05TCGLSdkNy39CNvlBLvXFQ7mmukPC
