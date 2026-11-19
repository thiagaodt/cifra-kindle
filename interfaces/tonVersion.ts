export interface TonVersion {
    tom: string;
    semitoneOffset: number;
    isOriginal: boolean;
    conteudo: string;
    /** Casa do capotraste (os acordes de `conteudo` estão na forma, não no tom que soa); null/ausente = sem capo. */
    capotraste?: number | null;
}
